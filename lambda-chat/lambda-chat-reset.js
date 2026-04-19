import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
    }

    return new PrismaClient({
        adapter: new PrismaPg(new Pool({ connectionString })),
    });
}

export const handler = async (event) => {

    const prisma = createPrismaClient();

    try {
        const result = await prisma.user.updateMany({
            where: {
                subscriptionStatus: 'active'
            },
            data: {
                chatMessagesToday: 0
            }
        })


        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'daily chat reset completed successfully',
                usersReset: result.count,
                timestamp: new Date().toISOString()
            })
        }

    } catch (error) {
        console.error('chat reset error:', error)

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'failed to reset the chat messages',
                details: error.message,
                timestamp: new Date().toISOString()
            })
        }
    } finally {
        await prisma.$disconnect()
    }
}