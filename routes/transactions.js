#!/usr/bin/env node
'use strict';

const express = require('express'); 
const router = express.Router(); 

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const jwtAuth = require('../middleware/jwtAuth');
const { typeCheck, parseQuery } = require('../middleware/verifyInput');

router.route('/')
    .post(jwtAuth, async (req, res) => {
        if (req.user.role === 'regular') {
            return res.status(403).json({ error: "not permitted" });
        }

        if (!req.body || !typeCheck(req.body)) {
            return res.status(400).json({ error: "invalid payload" });
        }

        let { utorid, type, spent, amount, relatedId, promotionIds, remark } = req.body;
        if (!utorid || !type) {
            return res.status(400).json({ error: "invalid payload" });
        }
        const user = await prisma.user.findUnique({
            where: { utorid: utorid },
            include: { promotions: true }
        });
        if (!user) {
            return res.status(400).json({ error: "user not found" });
        }
        
        if (type === "purchase") {
            if (spent == undefined || spent <= 0) {
                return res.status(400).json({ error: "spent must be > 0" });
            }
        } else if (type === "adjustment") {
            if (req.user.type === "cashier") {
                return res.status(403).json({ error: "not permitted" });
            }
            if (!amount || !relatedId) {
                return res.status(400).json({ error: "invalid payload" });
            }
            if (await prisma.transaction.findUnique({ where: { id: relatedId } }) == undefined) {
                return res.status(400).json({ error: "related transaction not found" });
            }
            spent = 0;
        } else {
            return res.status(400).json({ error: "invalid type" });
        }

        if (!remark) {
            remark = "";
        }
        
        let earned = Math.round(spent / 0.25);
        if (promotionIds !== undefined) {
            try {
                await prisma.$transaction(async (pm) => {
                    const now = Date.now()

                    for (const pid of promotionIds) {
                        let promotion = await pm.promotion.findUnique({ where: { id: pid } });

                        if (!promotion || promotion.end < now || (spent < promotion.minSpending && type !== "adjustment")) { 
                            throw new Error();
                        }

                        if (promotion.type === "onetime") {
                            if (user.promotions.some(p => p.id == pid)) {
                                await pm.user.update({
                                    where: { id: user.id },
                                    data: { promotions: { disconnect: { id: pid } } } // use promotion
                                });
                            } else { // already used
                                throw new Error();
                            }
                        }
                        earned += Math.round(spent * (promotion.rate * 100)) + promotion.points;
                    }

                    promotionIds = promotionIds.map(pid => ({ id: pid }));
                });
            } catch (err) {
                return res.status(400).json({ error: "invalid promotion" });
            }
        }

        const transaction_data = {
            data: {
                utorid: user.utorid,
                type: type,
                spent: spent,
                remark: remark,
                promotionIds: { connect: promotionIds },
                createdBy: req.user.utorid
            },
            include: { promotionIds: true }
        }

        let new_transaction;
        let updatePoints;
        if (type === "purchase") {
            transaction_data.data.earned = earned;
            new_transaction = await prisma.transaction.create(transaction_data);
            updatePoints = earned;
        } else { // type === "adjustment"
            transaction_data.data.amount = amount;
            transaction_data.data.relatedId = relatedId;
            new_transaction = await prisma.transaction.create(transaction_data);
            updatePoints = amount;
        }

        if (req.user.role !== 'cashier' || req.user.suspicious !== true) {
            await prisma.user.update({
                where: { id: user.id },
                data: { points: user.points + updatePoints }
            });
        }

        return res.status(201).json(new_transaction);
    })
    .get(jwtAuth, async (req, res) => {
        if (req.user.role !== 'manager' && req.user.role !== 'superuser') {
            return res.status(403).json({ error: "not permitted" });
        }

        const filters = parseQuery(req.query, ['utorid', 'createdBy', 'suspicious',
            'promotionId', 'type', 'relatedId', 'amount', 'operator', 'page', 'limit']);
        if (filters === false) {
            return res.status(400).json({ error: "invalid filters" });
        }
        delete filters.page;
        delete filters.limit;

        if (filters.relatedId !== undefined && (filters.type == undefined || filters.type === "purchase")) {
            return res.status(400).json({ error: "relatedId must be used with appropriate type" });
        }
        if ((filters.amount === undefined) !== (filters.operator === undefined)) {
            return res.status(400).json({ error: "amount must be used with operator" });
        } else if (filters.operator !== undefined && filters.operator !== "lte" && filters.operator !== "gte"){
            return res.status(400).json({ error: "invalid operator" });
        } else if (filters.amount !== undefined && filters.operator !== undefined) {
            const { operator, amount } = filters;
            filters.amount = { [operator]: amount };
            delete filters.operator;
        }

        const page = parseInt(req.query.page) || 1;
        const take = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * take;

        let transactions = await prisma.transaction.findMany({
            where: filters,
            skip: skip,
            take: take,
            include: { promotionIds: true }
        });

        res.json({
            count: transactions.length,
            results: transactions
        });
    });

router.get('/:transactionId', jwtAuth, async (req, res) => {
    if (req.user.role !== 'manager' && req.user.role !== 'superuser') {
        return res.status(403).json({ error: "not permitted" });
    }

    const id = Number(req.params.transactionId);
    if (!Number.isInteger(id)) {
        return res.status(404).json({ error: "invalid transaction id" });
    } 

    const transaction = await prisma.transaction.findUnique({ where: { id: id } });
    if(!transaction) {
        return res.status(404).json({ error: "transaction not found" });
    }

    res.json(transaction);
});

router.patch('/:transactionId/suspicious', jwtAuth, async (req, res) => {
    if (req.user.role !== 'manager' && req.user.role !== 'superuser') {
        return res.status(403).json({ error: "not permitted" });
    }

    if (!req.body || !typeCheck(req.body, 1)) {
        return res.status(400).json({ error: "invalid payload" });
    }

    const { suspicious } = req.body;
    if (suspicious === undefined) {
        return res.status(400).json({ error: "invalid payload" });
    }

    const id = Number(req.params.transactionId);
    if (!Number.isInteger(id)) {
        return res.status(404).json({ error: "invalid transaction id" });
    } 

    const transaction = await prisma.transaction.findUnique({ where: { id: id } });
    if(!transaction) {
        return res.status(404).json({ error: "transaction not found" });
    }

    let { utorid, amount, suspicious: init_sus } = transaction;
    if (init_sus === suspicious) { // no change
        amount = 0
    } else if (!init_sus && suspicious) { // false to true
        amount = -amount;
    }

    const updated_transaction = await prisma.transaction.update({
        where: { id: id },
        data: { suspicious: suspicious }
    });

    await prisma.user.update({
        where: { utorid: utorid },
        data: { points: { increment: amount } }
    });

    return res.json(updated_transaction);
});

module.exports = router;
