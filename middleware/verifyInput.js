#!/usr/bin/env node
'use strict';

const types = {
    utorid: "string",
    name: "string",
    email: "string",
    password: "string",
    role: "string",
    verified: "boolean",
    activiated: "boolean",
    suspicious: "boolean",
    birthday: "string",
    page: "number",
    limit: "number",
    old: "string",
    new: "string",
    type: "string",
    spent: "number",
    promotionIds: "array",
    remark: "string",
    startTime: "datetime",
    endTime: "datetime",
    description: "string",
    minSpending: "number",
    rate: "number",
    points: "number",
    started: "boolean",
    ended: "boolean",
    amount: "number",
    relatedId: "number",
    createdBy: "string",
    operator: "string",
    processed: "boolean"
}

function typeCheck(payload, expectedLength) {
    let actualLength = 0;

    for (const key in payload) {
        actualLength++;
        if (types.hasOwnProperty(key)) {
            if (types[key] === "array") {
                if (!Array.isArray(payload[key]) || !payload[key].every(item => typeof item === 'number')) {
                    return false;
                }
            } else if (types[key] === "datetime") {
                const date = new Date(payload[key]);
                if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(payload[key]) || isNaN(date.getTime())) {
                    return false;
                }
            } else if (typeof payload[key] != types[key]) { // unknown field or wrong data type
                return false;
            } 
        } else {
            return false;
        }
    }

    return !expectedLength || actualLength === expectedLength;
}

function parseQuery(query, allowedQueries) {
    const parsedQuery = {};

    for (const key in query) {
        if (allowedQueries.includes(key) && key in types) {
            if (types[key] === "string") {
                parsedQuery[key] = query[key];
            } else if (types[key] === "boolean") {
                if (query[key] == "true") {
                    parsedQuery[key] = true;
                } else if (query[key] == "false") {
                    parsedQuery[key] = false;
                } else {
                    return false; // error
                }
            } else if (types[key] === "number") {
                parsedQuery[key] = parseInt(query[key]);
                if (isNaN(parsedQuery[key])) {
                    return false;
                }
            }
        } else {
            return false;
        }
    }
    
    return parsedQuery;
}

module.exports = { typeCheck, parseQuery };
