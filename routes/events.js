'use strict';

const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const jwtAuth = require('../middleware/jwtAuth');
const { typeCheck, parseQuery } = require('../middleware/verifyInput');

// helpers 
function isoToDate(s) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}
function isPositiveNumber(v) {
    return v === null || (typeof v === 'number' && Number.isFinite(v) && v > 0);
}
function isNonNegativeInteger(v) {
    return Number.isInteger(v) && v >= 0;
}

// create event (manager or higher)
router.post('/', jwtAuth, async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'manager' && req.user.role !== 'superuser')) {
            return res.status(403).json({ error: "not permitted" });
        }
        if (!req.body) {
            console.log('events.create no body');
            return res.status(400).json({ error: "invalid payload" });
        }

        const { name, description, location, startTime, endTime, capacity, points } = req.body;

        if (!name || typeof name !== 'string' || !description || typeof description !== 'string'
            || !location || typeof location !== 'string') {
            console.log('events.create invalid payload');
            return res.status(400).json({ error: "invalid payload" });
        }

        const start = isoToDate(startTime);
        const end = isoToDate(endTime);
        if (!start || !end || end <= start) {
            console.log('events.create invalid dates');
            return res.status(400).json({ error: "invalid payload" });
        }

        if (!isNonNegativeInteger(points) || points <= 0) {
            console.log('events.create invalid points');
            return res.status(400).json({ error: "invalid payload" });
        }

        if (capacity !== undefined && capacity !== null && (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0)) {
            console.log('events.create invalid capacity');
            return res.status(400).json({ error: "invalid payload" });
        }

        const created = await prisma.event.create({
            data: {
                name,
                description,
                location,
                startTime: start,
                endTime: end,
                capacity: capacity === undefined ? null : capacity,
                pointsRemain: points,
                pointsAwarded: 0,
                published: false
            }
        });

        return res.status(201).json({
            id: created.id,
            name: created.name,
            description: created.description,
            location: created.location,
            startTime: created.startTime,
            endTime: created.endTime,
            capacity: created.capacity,
            pointsRemain: created.pointsRemain,
            pointsAwarded: created.pointsAwarded,
            published: created.published,
            organizers: [],
            guests: []
        });
    } catch (e) {
        console.log('events.create error:', e);
        return res.status(400).json({ error: "invalid payload" });
    }
});

// list events (regular users see only published; managers see extra filters)
router.get('/', jwtAuth, async (req, res) => {
    try {
        const q = req.query || {};
        const page = Math.max(1, parseInt(q.page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(q.limit) || 10));
        const skip = (page - 1) * limit;

        if (q.started !== undefined && q.ended !== undefined) {
            return res.status(400).json({ error: "invalid payload" });
        }

        const where = {};
        if (q.name) where.name = { contains: String(q.name), mode: 'insensitive' };
        if (q.location) where.location = { contains: String(q.location), mode: 'insensitive' };

        const now = new Date();

        // manager extra filter: published
        if (req.user.role === 'manager' || req.user.role === 'superuser') {
            if (q.published !== undefined) {
                const flag = String(q.published) === 'true';
                where.published = flag;
            }
            if (q.started !== undefined) {
                const startedFlag = String(q.started) === 'true';
                where.startTime = startedFlag ? { lte: now } : { gt: now };
            }
            if (q.ended !== undefined) {
                const endedFlag = String(q.ended) === 'true';
                where.endTime = endedFlag ? { lte: now } : { gt: now };
            }
        } else {
            // regular: only published events and active/all depending on started/ended filters
            where.published = true;
            if (q.started !== undefined) {
                const startedFlag = String(q.started) === 'true';
                where.startTime = startedFlag ? { lte: now } : { gt: now };
            }
            if (q.ended !== undefined) {
                const endedFlag = String(q.ended) === 'true';
                where.endTime = endedFlag ? { lte: now } : { gt: now };
            }
        }

        // fetch candidates
        const candidates = await prisma.event.findMany({
            where,
            orderBy: { startTime: 'desc' },
            include: { guests: true } // compute numGuests
        });

        // compute numGuests and filter showFull if requested
        const showFull = String(q.showFull) === 'true';
        const filtered = candidates.filter(e => {
            const numGuests = (e.guests || []).length;
            if (!showFull && e.capacity !== null && numGuests >= e.capacity) return false;
            return true;
        });

        const total = filtered.length;
        const pageResults = filtered.slice(skip, skip + limit);

        const results = pageResults.map(e => {
            const numGuests = (e.guests || []).length;
            const base = {
                id: e.id,
                name: e.name,
                location: e.location,
                startTime: e.startTime,
                endTime: e.endTime,
                capacity: e.capacity,
                numGuests
            };
            if (req.user.role === 'manager' || req.user.role === 'superuser') {
                base.pointsRemain = e.pointsRemain;
                base.pointsAwarded = e.pointsAwarded;
                base.published = e.published;
            }
            return base;
        });

        return res.json({ count: total, results });
    } catch (e) {
        return res.status(400).json({ error: "invalid payload" });
    }
});

// get single event
router.get('/:eventId', jwtAuth, async (req, res) => {
    try {
        const id = Number(req.params.eventId);
        if (!Number.isInteger(id)) return res.status(404).json({ error: "invalid event id" });

        const e = await prisma.event.findUnique({
            where: { id },
            include: { organizers: true, guests: true }
        });
        if (!e) return res.status(404).json({ error: "not found" });

        const now = new Date();

        // manager or organizer can see full details
        const isManager = req.user && (req.user.role === 'manager' || req.user.role === 'superuser');
        const isOrganizer = e.organizers && e.organizers.some(o => o.id === req.user.id);

        if (!isManager && !isOrganizer && !e.published) {
            return res.status(404).json({ error: "not found" });
        }

        const numGuests = (e.guests || []).length;
        if (isManager || isOrganizer) {
            return res.json({
                id: e.id,
                name: e.name,
                description: e.description,
                location: e.location,
                startTime: e.startTime,
                endTime: e.endTime,
                capacity: e.capacity,
                pointsRemain: e.pointsRemain,
                pointsAwarded: e.pointsAwarded,
                published: e.published,
                organizers: (e.organizers || []).map(o => ({ id: o.id, utorid: o.utorid, name: o.name })),
                guests: (e.guests || []).map(g => ({ id: g.id, utorid: g.utorid, name: g.name }))
            });
        }

        // regular user view
        return res.json({
            id: e.id,
            name: e.name,
            description: e.description,
            location: e.location,
            startTime: e.startTime,
            endTime: e.endTime,
            capacity: e.capacity,
            organizers: (e.organizers || []).map(o => ({ id: o.id, utorid: o.utorid, name: o.name })),
            numGuests
        });
    } catch (e) {
        return res.status(400).json({ error: "invalid payload" });
    }
});

// update event (manager or organizer)
router.patch('/:eventId', jwtAuth, async (req, res) => {
    try {
        if (!req.user) return res.status(403).json({ error: "not permitted" });

        const id = Number(req.params.eventId);
        if (!Number.isInteger(id)) return res.status(404).json({ error: "invalid event id" });

        const existing = await prisma.event.findUnique({
            where: { id },
            include: { organizers: true, guests: true }
        });
        if (!existing) return res.status(404).json({ error: "not found" });

        const isManager = req.user && (req.user.role === 'manager' || req.user.role === 'superuser');
        const isOrganizer = existing.organizers && existing.organizers.some(o => o.id === req.user.id);
        if (!isManager && !isOrganizer) {
            return res.status(403).json({ error: "not permitted" });
        }

        if (!req.body) return res.status(400).json({ error: "invalid payload" });

        const now = new Date();
        const startedAlready = existing.startTime <= now;
        const endPassedAlready = existing.endTime <= now;
        const numGuests = (existing.guests || []).length;

        const {
            name, description, location, startTime, endTime, capacity, points, published
        } = req.body;

        const update = {};

        if (name !== undefined) {
            if (startedAlready) return res.status(400).json({ error: "invalid payload" });
            if (!name || typeof name !== 'string') return res.status(400).json({ error: "invalid payload" });
            update.name = name;
        }
        if (description !== undefined) {
            if (startedAlready) return res.status(400).json({ error: "invalid payload" });
            if (!description || typeof description !== 'string') return res.status(400).json({ error: "invalid payload" });
            update.description = description;
        }
        if (location !== undefined) {
            if (startedAlready) return res.status(400).json({ error: "invalid payload" });
            if (!location || typeof location !== 'string') return res.status(400).json({ error: "invalid payload" });
            update.location = location;
        }
        if (startTime !== undefined) {
            const s = isoToDate(startTime);
            if (!s) return res.status(400).json({ error: "invalid payload" });
            if (startedAlready) return res.status(400).json({ error: "invalid payload" });
            if (s < now) return res.status(400).json({ error: "invalid payload" });
            update.startTime = s;
        }
        if (endTime !== undefined) {
            const e = isoToDate(endTime);
            if (!e) return res.status(400).json({ error: "invalid payload" });
            if (endPassedAlready) return res.status(400).json({ error: "invalid payload" });
            const refStart = update.startTime || existing.startTime;
            if (e <= refStart) return res.status(400).json({ error: "invalid payload" });
            update.endTime = e;
        }
        if (capacity !== undefined) {
            if (startedAlready) return res.status(400).json({ error: "invalid payload" });
            if (capacity !== null && (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0)) {
                return res.status(400).json({ error: "invalid payload" });
            }
            // capacity reduction check
            if (capacity !== null && existing.capacity !== null && capacity < numGuests) {
                return res.status(400).json({ error: "invalid payload" });
            }
            update.capacity = capacity === undefined ? undefined : capacity;
        }
        if (points !== undefined) {
            // only managers can set points
            if (!isManager) return res.status(403).json({ error: "not permitted" });
            if (!isNonNegativeInteger(points) || points <= 0) return res.status(400).json({ error: "invalid payload" });
            // ensure total allocated not reduced below already awarded
            if (points < existing.pointsAwarded) return res.status(400).json({ error: "invalid payload" });
            // adjust pointsRemain relative to new total:
            const totalAllocatedOld = (existing.pointsRemain || 0) + (existing.pointsAwarded || 0);
            const delta = points - totalAllocatedOld;
            update.pointsRemain = (existing.pointsRemain || 0) + delta;
        }
        if (published !== undefined) {
            // only managers can change published; published can only be set to true
            if (!isManager) return res.status(403).json({ error: "not permitted" });
            if (published !== true) return res.status(400).json({ error: "invalid payload" });
            update.published = true;
        }

        if (Object.keys(update).length === 0) {
            return res.json({ id: existing.id, name: existing.name, location: existing.location });
        }

        const updated = await prisma.event.update({
            where: { id },
            data: update
        });

        const response = { id: updated.id, name: updated.name, location: updated.location };
        for (const k of Object.keys(update)) response[k] = updated[k];
        return res.json(response);
    } catch (e) {
        return res.status(400).json({ error: "invalid payload" });
    }
});

// delete event (manager only)
router.delete('/:eventId', jwtAuth, async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'manager' && req.user.role !== 'superuser')) {
            return res.status(403).json({ error: "not permitted" });
        }
        const id = Number(req.params.eventId);
        if (!Number.isInteger(id)) return res.status(404).json({ error: "invalid event id" });

        const existing = await prisma.event.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "not found" });

        if (existing.published) return res.status(400).json({ error: "invalid payload" });

        await prisma.event.delete({ where: { id } });
        return res.status(204).send();
    } catch (e) {
        return res.status(400).json({ error: "invalid payload" });
    }
});

module.exports = router;