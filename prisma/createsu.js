/*
 * Complete this script so that it is able to add a superuser to the database
 * Usage example: 
 *   node prisma/createsu.js clive123 clive.su@mail.utoronto.ca SuperUser123!
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const [utorid, email, password] = process.argv.slice(2);

    if (!utorid || !email || !password) {
        console.log('Usage: node prisma/createsu.js <utorid> <email> <password>');
        process.exit(1);
    }

    await prisma.user.create({
        data: {
            utorid: utorid,
            email: email,
            password: password,
            role: 'superuser',
            verified: true,
        }
    })
}

main().finally(() => prisma.$disconnect());