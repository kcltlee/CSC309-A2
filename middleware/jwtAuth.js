#!/usr/bin/env node
'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const jwt = require('jsonwebtoken'); 
require('dotenv').config(); 
const JWT_SECRET = process.env.JWT_SECRET; 

const jwtAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: "missing token" });
    }

    // parse auth header for token
    const token = authHeader.split(' ')[1]; // Authorization: Bearer <token>
    if (!token) {
        return res.status(401).json({ error: "invalid token" });
    }

    // check validity of token
    jwt.verify(token, JWT_SECRET, async (err, userData) => {
        if (err) {
            return res.status(401).json({ error: "invalid or expired token" });
        } else {
            // find user with matching id
            const user = await prisma.user.findUnique({ where: {id: userData.id } });
            if (!user) {
                return res.status(401).json({ error: "user not found" });
            }

            // set req.user if found
            req.user = user; 
            next();
        }
    });
}

module.exports = jwtAuth;