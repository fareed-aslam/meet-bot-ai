'use client'

import React from 'react'
import { useIntegrations } from './hooks/useIntegrations'
import SetupForm from './components/SetupForm'
import IntegrationCard from './components/IntegrationCard'
import { AnimatePresence, motion } from 'framer-motion'
import { Reveal } from '@/components/animations/reveal'
import { Stagger, StaggerItem } from '@/components/animations/stagger'

function Integrations() {

    const {
        integrations,
        loading,
        setupMode,
        setSetupMode,
        setupData,
        setSetupData,
        setupLoading,
        setSetupLoading,
        fetchIntegrations,
        fetchSetupData,
        handleConnect,
        handleDisconnect,
        handleSetupSubmit
    } = useIntegrations()

    if (loading) {
        return (
            <div className='min-h-screen bg-background flex items-center justify-center p-6'>
                <div className='flex flex-col items-center justify-center'>
                    <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-foreground mb-4'></div>
                    <div className='text-foreground'>Loading Integrations...</div>
                </div>
            </div>
        )
    }
    return (
        <div className='min-h-screen bg-background p-6'>
            <div className='max-w-4xl mx-auto'>
                <Reveal>
                    <div className='mb-8'>
                        <h1 className='text-2xl font-bold text-foreground mb-2'>Integrations</h1>

                        <p className='text-muted-foreground'>
                            Connect your favourite tools to automatically add action items from meetings
                        </p>
                    </div>
                </Reveal>

                <AnimatePresence>
                    {setupMode && (
                        <motion.div
                            className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className='bg-card rounded-lg p-6 border border-border max-w-md w-full mx-4'
                                initial={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(8px)' }}
                                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <h2 className='text-lg font-semibold text-foreground mb-4'>
                                    Setup {setupMode.charAt(0).toUpperCase() + setupMode.slice(1)}
                                </h2>

                                <SetupForm
                                    platform={setupMode}
                                    data={setupData}
                                    onSubmit={handleSetupSubmit}
                                    onCancel={() => {
                                        setSetupMode(null)
                                        setSetupData(null)
                                        window.history.replaceState({}, '', '/integrations')
                                    }}
                                    loading={setupLoading}
                                />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <Stagger className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
                    {integrations.map((integration) => (
                        <StaggerItem key={integration.platform} y={10}>
                            <IntegrationCard
                                integration={integration}
                                onConnect={handleConnect}
                                onDisconnect={handleDisconnect}
                                onSetup={(platform: string) => {
                                    setSetupMode(platform)
                                    fetchSetupData(platform)
                                }}
                            />
                        </StaggerItem>
                    ))}
                </Stagger>

                <Reveal>
                    <div className='mt-8 bg-card rounded-lg p-6 border border-border'>
                        <h3 className='font-semibold text-foreground mb-2'>How it wokrs </h3>

                        <ol className='text-sm text-muted-foreground space-y-2'>
                            <li>1. Connect your preffered tools above</li>
                            <li>2. Choose where to send action items during setup</li>
                            <li>3. In meetings, hover over action items and click &quot;Add to&quot;</li>
                            <li>4. Select which tool(s) to add the task to from the dropdown</li>
                        </ol>
                    </div>
                </Reveal>

            </div>
        </div>
    )
}

export default Integrations