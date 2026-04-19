import React from 'react'

function StatsSection() {
    return (

        <section className='py-20 bg-transparent'>
            <div className='max-w-6xl mx-auto px-4'>
                <div className='grid md:grid-cols-4 gap-8 mb-20 pb-16'>
                    <div className='text-center group'>
                        <div className='text-4xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600  bg-clip-text text-transparent mb-2'>
                            2+
                        </div>
                        <p className='text-muted-foreground'>Happy Users</p>
                    </div>
                    <div className='text-center group'>
                        <div className='text-4xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600  bg-clip-text text-transparent mb-2'>
                            99.69%
                        </div>
                        <p className='text-muted-foreground'>Uptime</p>
                    </div>
                    <div className='text-center group'>
                        <div className='text-4xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600  bg-clip-text text-transparent mb-2'>
                            2min
                        </div>
                        <p className='text-muted-foreground'>Setup Time</p>
                    </div>
                    <div className='text-center group'>
                        <div className='text-4xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600  bg-clip-text text-transparent mb-2'>
                            50hrs
                        </div>
                        <p className='text-muted-foreground'>Saved Per Month</p>
                    </div>
                </div>

            </div>
        </section>
    )
}

export default StatsSection