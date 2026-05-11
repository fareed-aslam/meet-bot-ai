const { PrismaClient } = require('../lib/generated/client')

async function main() {
    const prisma = new PrismaClient()
    try {
        const meetings = await prisma.meeting.findMany({
            orderBy: { endTime: 'desc' },
            take: 100,
            select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                meetingEnded: true,
                transcriptReady: true,
                processed: true,
                emailSent: true,
                botId: true,
                calendarEventId: true,
                userId: true,
                isFromCalendar: true,
            },
        })

        console.log(JSON.stringify(meetings, null, 2))
    } finally {
        await prisma.$disconnect()
    }
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
