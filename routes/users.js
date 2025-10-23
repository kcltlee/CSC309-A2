#!/usr/bin/env node
'use strict';

const express = require('express'); 
const router = express.Router(); 

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const multer = require('multer')
const upload = multer({ dest: 'uploads/' })

const jwtAuth = require('../middleware/jwtAuth');
const { typeCheck, parseQuery } = require('../middleware/verifyInput');

// helper function to extract appropriate info to return
function getUserInfo(user) {
    return {
        id: user.id,
        utorid: user.utorid,
        name: user.name,
        email: user.email,
        birthday: user.birthday,
        role: user.role,
        points: user.points,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        verified: user.verified,
        avatarUrl: user.avatarUrl,
        promotions: user.promotions
    }
}

router.route('/')
    .post(jwtAuth, async (req, res) => {
        if (req.user.role === 'regular') {
            return res.status(403).json({ error: "not permitted" });
        }
        if (!req.body || !typeCheck(req.body, 3)) {
            return res.status(400).json({ error: "invalid payload" });
        }

        const { utorid, name, email } = req.body;
        if (!utorid || !/^[a-zA-Z0-9]{8}$/.test(utorid))  {
            return res.status(400).json({ error: "invalid utorid" });
        } else if (await prisma.user.findUnique({ where: { utorid: utorid } })) {
            return res.status(409).json({ error: "utorid already exists" });
        }
        
        if (!name || name.length < 1 || name.length > 50) {
            return res.status(400).json({ error: "invalid name" });
        }
        
        if (!email || !/^.+\..+@(?:mail\.)?utoronto\.ca$/.test(email)
            || await prisma.user.findUnique({ where: { email } })) {
            return res.status(400).json({ error: "invalid uoft email" });
        }

        const new_user = await prisma.user.create({
            data: {
                utorid: utorid,
                name: name,
                email: email,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                promotions: { connect: promotionIds }
            }
        });

        res.status(201).json({
            id: new_user.id,
            utorid: new_user.utorid,
            name: new_user.name,
            email: new_user.email,
            verified: new_user.verified,
            expiresAt: new_user.expiresAt,
            resetToken: new_user.resetToken
        });
    })
    .get(jwtAuth, async (req, res) => {
        if (req.user.role !== 'manager' && req.user.role !== 'superuser') {
            return res.status(403).json({ error: "not permitted" });
        }

        const filters = parseQuery(req.query, ['name', 'role', 'verified', 'activated', 'page', 'limit']);
        if (filters === false) {
            return res.status(400).json({ error: "invalid filters" });
        }
        delete filters.page;
        delete filters.limit;

        const page = parseInt(req.query.page) || 1;
        const take = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * take;

        let users = await prisma.user.findMany({
            where: filters,
            skip: skip,
            take: take,
            include: { promotions: true }
        });

        users = users.map(user => getUserInfo(user));

        res.json({
            count: users.length,
            results: users
        });
    }); 
    
router.route('/me')
    .patch(jwtAuth, upload.single('avatar'), async (req, res) => {
        if (!req.body || !typeCheck(req.body) || Object.keys(req.body).length > 3 ||  Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "invalid payload" });
        }

        const { name, email, birthday } = req.body;
        const avatar = req.file;
        const update_data = {};

        if (name !== undefined) {
            if (name.length < 1 || name.length > 50) {
                return res.status(400).json({ error: "invalid name" });
            }
            update_data.name = name;
        }
        
        if (email !== undefined) {
            if (!/^.+\..+@(?:mail\.)?utoronto\.ca$/.test(email)
                || await prisma.user.findUnique({ where: { email } })) {
                return res.status(400).json({ error: "invalid uoft email" });
            }
            update_data.email = email;
        }

        if (birthday !== undefined) {
            const date = new Date(birthday);
            if (isNaN(date.getTime())) {
                return res.status(400).json({ error: "invalid birthday (yyyy-mm-dd)" });
            }
            update_data.birthday = birthday;
        }

        if (avatar !== undefined) {
            update_data.avatarUrl = avatar.path;
        }

        const updated_user = await prisma.user.update({
            where: { id: req.user.id },
            data: update_data
        });

        res.json(getUserInfo(updated_user));
    })
    .get(jwtAuth, async (req, res) => {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if(!user) {
            return res.status(404).json({ error: "user not found" }); // should not be possible
        }

        res.json(getUserInfo(user));
    });

router.patch('/me/password', jwtAuth, async (req, res) => {
    if (!req.body || !typeCheck(req.body, 2)) {
        return res.status(400).json({ error: "invalid payload" });
    }

    const { old, new: newPassword } = req.body;

    if (!old || old !== req.user.password) {
        return res.status(403).json({ error: "incorrect password" });
    }
    
    if (!newPassword || newPassword.length < 8 || newPassword.length > 20
        || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/.test(newPassword)) {
        return res.status(400).json({ error: "invalid password" });
    }

    await prisma.user.update({
        where: { id: req.user.id },
        data: { password: newPassword }
    });

    res.status(200).send({ message: "updated password successfully" });
});

router.route('/:userId')
    .get(jwtAuth, async (req, res) => {
        if (req.user.role === 'regular') {
            return res.status(403).json({ error: "not permitted" });
        }

        const id = Number(req.params.userId);
        if (!Number.isInteger(id)) {
            return res.status(404).json({ error: "invalid user id" });
        } 

        const user = await prisma.user.findUnique({ where: { id: id } });
        if(!user) {
            return res.status(404).json({ error: "user not found" });
        }

        let result = getUserInfo(user);
        if (req.user.role === 'cashier') {
            result = {
                id: user.id,
                utorid: user.utorid,
                name: user.name,
                points: user.points,
                verified: user.verified,
                promotions: user.promotions
            }
        }

        res.json(result);
    })
    .patch(jwtAuth, async (req, res) => {
        if (req.user.role !== 'manager' && req.user.role !== 'superuser') {
            return res.status(403).json({ error: "not permitted" });
        }
        if (!req.body || !typeCheck(req.body) || Object.keys(req.body).length > 4 ||  Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "invalid payload" });
        }

        const id = Number(req.params.userId);
        if (!Number.isInteger(id)) {
            return res.status(404).json({ error: "invalid user id" });
        } 

        const user = await prisma.user.findUnique({ where: { id: id } });
        if(!user) {
            return res.status(404).json({ error: "user not found" });
        }

        const update_data = {};
        const { email, verified, suspicious, role } = req.body;

        if (email !== undefined) {
            update_data.email = email;
        }

        if (verified !== undefined) {
            if (verified === false) {
                return res.status(400).json({ error: "verified must be true" });
            }
            update_data.verified = verified;
        }
        
        if (role !== undefined) {
            if (role !== 'regular' && role !== 'cashier' && role !== 'manager' && role !== 'superuser') {
                return res.status(400).json({ error: "invalid role" });
            }
            if (req.user.role === 'manager' && (role === 'manager' || role === 'superuser')) {
                return res.status(403).json({ error: "not permitted" });
            }
            if (role === 'cashier' && user.suspicious === true) {
                return res.status(400).json({ error: "user cannot be suspicious" });
            }
            update_data.role = role;
        }  

        if (suspicious !== undefined) {
            update_data.suspicious = suspicious;
        }

        await prisma.user.update({
            where: { id: id },
            data: update_data
        });

        update_data.id = user.id;
        update_data.utorid = user.utorid;
        update_data.name = user.name;

        res.json(update_data);
    });

module.exports = router;