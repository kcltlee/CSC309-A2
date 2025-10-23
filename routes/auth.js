#!/usr/bin/env node
'use strict';

const express = require('express'); 
const router = express.Router(); 

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { v4: uuid } = require('uuid');

const jwt = require('jsonwebtoken'); 
require('dotenv').config(); 
const JWT_SECRET = process.env.JWT_SECRET; 

const { typeCheck } = require('../middleware/verifyInput');

const ipRequests = {};

router.post('/tokens', async (req, res) => {
    if (!req.body || !typeCheck(req.body, 2)) {
        return res.status(400).json({ error: "invalid payload" });
    }

    const { utorid, password } = req.body;
    if (!utorid || password === undefined)  {
        return res.status(400).json({ error: "invalid payload" });
    }

    const user = await prisma.user.findUnique({
        where: {
            utorid: utorid,
            password: password
        }
    });

    if (!user) {
        return res.status(400).json({ error: "user not found" });
    }

    const userData = {
        id: user.id,
        role: user.role
    }

    const token = jwt.sign(userData, JWT_SECRET); 
    res.json({
        token,
        expiresAt: user.expiresAt
    }); 
});

router.post('/resets', async (req, res) => {
    const ip = req.ip;
    const now = Date.now();

    if (ipRequests[ip] && now - ipRequests[ip] < 60000) { // request made < 60 secs ago
        return res.status(429).json({ error: "too many requests" });
    } else {
        
    }
    
    if (!req.body || !typeCheck(req.body, 1)) {
        return res.status(400).json({ error: "invalid payload" });
    }

    const { utorid } = req.body;
    if (!utorid)  {
        return res.status(400).json({ error: "invalid payload" });
    }

    const user = await prisma.user.findUnique({ where: { utorid: utorid } });
    if (!user) {
        return res.status(400).json({ error: "user not found" });
    }

    ipRequests[ip] = now;
    const resetInfo = {
        expiresAt: new Date(now + 60 * 60 * 1000), // 1 hour later
        resetToken: uuid()
    }

    await prisma.user.update({
        where: { utorid: utorid },
        data: resetInfo
    });

    res.status(202).json(resetInfo);
});

router.post('/resets/:resetToken', async (req, res) => {
    if (!req.body || !typeCheck(req.body, 2)) {
        return res.status(400).json({ error: "invalid payload" });
    }

    const { utorid, password } = req.body;
    if (!utorid)  {
        return res.status(400).json({ error: "invalid payload" });
    }
    if (!password || password.length < 8 || password.length > 20
        || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/.test(password)) {
        return res.status(400).json({ error: "invalid password" });
    }

    const user = await prisma.user.findUnique({ where: { utorid: utorid } });
    if (!user) {
        return res.status(400).json({ error: "user not found" });
    }

    const resetToken = req.params.resetToken;
    if (!resetToken || resetToken !== user.resetToken) {
        return res.status(404).json({ error: "invalid reset token" });
    } else if (Date.now() > user.expiresAt) {
        return res.status(410).json({ error: "reset token expired" });
    }

    await prisma.user.update({
        where: { utorid: utorid },
        data: { password: password }
    });

    res.status(200).send({ message: "reset password successfully" });
});

module.exports = router;