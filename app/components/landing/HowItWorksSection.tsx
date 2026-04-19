import React from 'react'
import { Stagger, StaggerItem } from '@/components/animations/stagger'

function HowItWorksSection() {
    return (
        <section className='py-20 bg-transparent'>
            <div className='max-w-6xl mx-auto px-4'>
                <div className='text-center mb-16'>
                    <h2 className='text-3xl md:text-4xl font-bold text-foreground mb-4'>
                        How It {' '}
                        <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600  bg-clip-text text-transparent">
                            Works
                        </span>

                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Get Started in minutes with our simple 3-step-process
                    </p>
                </div>
                <Stagger className='grid md:grid-cols-3 gap-12'>
                    <StaggerItem>
                        <div className='text-center group'>
                            <div className='w-20 h-20 mx-auto mb-6 rounded-full border-2 border-blue-500 bg-muted/50 text-blue-600 flex items-center justify-center text-2xl font-bold group-hover:scale-110 group-hover:bg-blue-500/10 transition-all duration-300'>
                                1
                            </div>
                            <h3 className='text-2xl font-semibold text-foreground mb-4'>Connect Calendar</h3>
                            <p className='text-muted-foreground text-lg leading-relaxed'>
                                Link your Google Calendar and we&apos;ll automatically detect your meetings
                            </p>
                        </div>
                    </StaggerItem>
                    <StaggerItem>
                        <div className='text-center group'>
                            <div className='w-20 h-20 mx-auto mb-6 rounded-full border-2 border-blue-500 bg-muted/50 text-blue-600 flex items-center justify-center text-2xl font-bold group-hover:scale-110 group-hover:bg-blue-500/10 transition-all duration-300'>
                                2
                            </div>
                            <h3 className='text-2xl font-semibold text-foreground mb-4'>Bot Joins Meeting</h3>
                            <p className='text-muted-foreground text-lg leading-relaxed'>
                                Our AI bot automatically joins and records your meetings with full transcription
                            </p>
                        </div>
                    </StaggerItem>
                    <StaggerItem>
                        <div className='text-center group'>
                            <div className='w-20 h-20 mx-auto mb-6 rounded-full border-2 border-blue-500 bg-muted/50 text-blue-600 flex items-center justify-center text-2xl font-bold group-hover:scale-110 group-hover:bg-blue-500/10 transition-all duration-300'>
                                3
                            </div>
                            <h3 className='text-2xl font-semibold text-foreground mb-4'>Get Insights</h3>
                            <p className='text-muted-foreground text-lg leading-relaxed'>
                                Receive summaries, action items, and push them to your faviourite tools instantly
                            </p>
                        </div>
                    </StaggerItem>
                </Stagger>
            </div>
        </section>
    )
}

export default HowItWorksSection