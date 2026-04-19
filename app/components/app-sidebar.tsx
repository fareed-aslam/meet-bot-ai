import { Bot, DollarSign, Home, Layers3, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { useUsage } from "../contexts/UsageContext";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const items = [
    {
        title: "Home",
        url: "/home",
        icon: Home,
    },
    {
        title: "Integrations",
        url: "/integrations",
        icon: Layers3,
    },
    {
        title: "Settings",
        url: "/settings",
        icon: Settings,
    },
    {
        title: "Chat with AI",
        url: "/chat",
        icon: Bot,
    },
    {
        title: "Pricing",
        url: "/pricing",
        icon: DollarSign,
    },
]

export function AppSidebar() {
    const pathname = usePathname()
    const { usage, limits } = useUsage()
    const [botName, setBotName] = useState('Meeting Bot')
    const [botImageUrl, setBotImageUrl] = useState<string | null>(null)

    const fetchBotSettings = async () => {
        try {
            const response = await fetch('/api/user/bot-settings', { cache: 'no-store' })
            if (!response.ok) return
            const data = await response.json()
            setBotName(typeof data?.botName === 'string' && data.botName.trim() ? data.botName : 'Meeting Bot')
            setBotImageUrl(typeof data?.botImageUrl === 'string' && data.botImageUrl.trim() ? data.botImageUrl : null)
        } catch {
            // ignore
        }
    }

    useEffect(() => {
        fetchBotSettings()

        const handler = () => {
            fetchBotSettings()
        }

        window.addEventListener('bot-settings-updated', handler as EventListener)
        return () => window.removeEventListener('bot-settings-updated', handler as EventListener)
    }, [])

    const meetingsLocked = Boolean(usage && limits.meetings === 0)
    const chatLocked = Boolean(usage && limits.chatMessages === 0)

    const meetingProgress = usage && limits.meetings !== -1 && limits.meetings > 0
        ? Math.min((usage.meetingsThisMonth / limits.meetings) * 100, 100)
        : 0

    const chatProgress = usage && limits.chatMessages !== -1 && limits.chatMessages > 0
        ? Math.min((usage.chatMessagesToday / limits.chatMessages) * 100, 100)
        : 0


    const getUpgradeInfo = () => {
        if (!usage) return null

        switch (usage.currentPlan) {
            case 'free':
                return {
                    title: "Upgrade to Starter",
                    description: "Get 10 meetings per month and 30 daily chat messages",
                    showButton: true
                }
            case 'starter':
                return {
                    title: "Upgrade to Pro",
                    description: "Get 30 meetings per month and 100 daily chat messages",
                    showButton: true
                }

            case 'pro':
                return {
                    title: "Upgrade to Premium",
                    description: "Get unlimited meetings and chat messages",
                    showButton: true
                }
            case 'premium':
                return {
                    title: "You're on Premium broski!",
                    description: "Enjoying unlimited access to all features",
                    showButton: false
                }

            default:
                return {
                    title: "Upgrade Your Plan",
                    description: "Get access to more features",
                    showButton: true
                }
        }
    }

    const upgradeInfo = getUpgradeInfo()

    return (
        <Sidebar collapsible="none" className="border-r border-sidebar-border h-screen">
            <SidebarHeader className="border-b border-sidebar-border p-4">
                <Link href="/home" className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
                        {botImageUrl ? (
                            <img src={botImageUrl} alt={botName} className="h-8 w-8 object-cover" />
                        ) : (
                            <Bot className="w-4 h-4" />
                        )}
                    </div>
                    <span className="text-lg font-semibold text-sidebar-foreground">
                        {botName}
                    </span>
                </Link>
            </SidebarHeader>

            <SidebarContent className="flex-1 p-4">
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu className="space-y-2">
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.url}
                                        className="w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                                    >
                                        <Link href={item.url}>
                                            <item.icon className="w-4 h-4" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-4 mt-auto">
                {usage && (
                    <div className="rounded-lg bg-sidebar-accent/50 p-3 mb-3">
                        <p className="text-xs font-medium text-sidebar-accent-foreground mb-3">
                            Current Plan: {usage.currentPlan.toUpperCase()}
                        </p>

                        <div className="space-y-2 mb-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-sidebar-accent-foreground/70">
                                    Meetings
                                </span>
                                <span className="text-xs text-sidebar-accent-foreground/70">
                                    {meetingsLocked ? 'Locked' : `${usage.meetingsThisMonth}/${limits.meetings === -1 ? '∞' : limits.meetings}`}
                                </span>
                            </div>
                            {!meetingsLocked && limits.meetings !== -1 && (
                                <div className="w-full bg-sidebar-accent/30 rounded-full h-2">
                                    <div
                                        className="bg-sidebar-primary h-2 rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${meetingProgress}%` }}
                                    > </div>
                                </div>
                            )}
                            {limits.meetings === -1 && (
                                <div className="text-xs text-sidebar-accent-foreground/50 italic">Unlimited</div>
                            )}
                            {meetingsLocked && (
                                <div className="text-xs text-sidebar-accent-foreground/50 italic">Upgrade to unlock meetings</div>
                            )}
                        </div>

                        <div className="space-y-2 mb-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-sidebar-accent-foreground/70">
                                    Chat Messages
                                </span>
                                <span className="text-xs text-sidebar-accent-foreground/70">
                                    {chatLocked ? 'Locked' : `${usage.chatMessagesToday}/${limits.chatMessages === -1 ? '∞' : limits.chatMessages}`}
                                </span>
                            </div>
                            {!chatLocked && limits.chatMessages !== -1 && (
                                <div className="w-full bg-sidebar-accent/30 rounded-full h-2">
                                    <div
                                        className="bg-sidebar-primary h-2 rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${chatProgress}%` }}
                                    > </div>
                                </div>
                            )}
                            {limits.chatMessages === -1 && (
                                <div className="text-xs text-sidebar-accent-foreground/50 italic">Unlimited</div>
                            )}
                            {chatLocked && (
                                <div className="text-xs text-sidebar-accent-foreground/50 italic">Upgrade to unlock chat</div>
                            )}
                        </div>

                    </div>
                )}

                {upgradeInfo && (
                    <div className="rounded-lg bg-sidebar-accent p-4">
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-sidebar-accent-foreground">
                                    {upgradeInfo.title}
                                </p>
                                <p className="text-xs text-sidebar-accent-foreground/70">
                                    {upgradeInfo.description}
                                </p>
                            </div>
                            {upgradeInfo.showButton && (
                                <Link href="/pricing">
                                    <Button className="w-full rounded-md bg-sidebar-primary px-3 py-2 text-xs font-medium text-sidebar-primary-foreground transition-colors hover:bg-sidebar-primary/90 cursor-pointer">
                                        {upgradeInfo.title}
                                    </Button>
                                </Link>
                            )}

                            {!upgradeInfo.showButton && (
                                <div className="text-center py-2">
                                    <span className="text-xs text-sidebar-accent-foreground/60">🎉 Thank you for your support!</span>
                                </div>
                            )}

                        </div>
                    </div>
                )}

            </SidebarFooter>

        </Sidebar>
    )
}