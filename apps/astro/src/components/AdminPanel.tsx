import React, { useState, useEffect } from 'react';
import { EmailViewer } from './EmailViewer';

interface Email {
    id: string;
    sender: string;
    messageTo: string;
    subject: string;
    createdAt: string;
    text?: string | null;
    html?: string | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("ErrorBoundary caught error:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg">
                    <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
                    <p className="text-sm mb-4">The Admin Panel crashed. Error details below:</p>
                    <pre className="text-xs font-mono bg-white/50 p-4 rounded overflow-auto whitespace-pre-wrap max-h-[200px]">
                        {this.state.error?.toString()}
                        {this.state.error?.stack}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 text-sm"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function AdminPanelContent() {
    const [activeTab, setActiveTab] = useState<'inbox' | 'stats' | 'settings'>('inbox');
    const [stats, setStats] = useState<{ senders: any[], receivers: any[] } | null>(null);
    const [blocklist, setBlocklist] = useState<any[]>([]);
    const [newBlock, setNewBlock] = useState('');

    // Restore missing state variables
    const [apiKey, setApiKey] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const storedKey = localStorage.getItem('vmail_admin_key');
        if (storedKey) {
            setApiKey(storedKey);
            setIsAuthenticated(true);
            fetchEmails(storedKey);
        }
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) return;
        localStorage.setItem('vmail_admin_key', apiKey);
        setIsAuthenticated(true);
        fetchEmails(apiKey);
    };

    const logout = () => {
        localStorage.removeItem('vmail_admin_key');
        setApiKey('');
        setIsAuthenticated(false);
        setEmails([]);
        setSelectedIds(new Set());
    };

    const fetchEmails = async (key: string, searchQuery: string = '') => {
        setLoading(true);
        setError('');
        try {
            const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev";
            const url = searchQuery
                ? `${WORKER_URL}/api/v1/admin/emails?limit=50&search=${encodeURIComponent(searchQuery)}`
                : `${WORKER_URL}/api/v1/admin/emails?limit=50`;

            const res = await fetch(url, {
                headers: { 'X-API-Key': key }
            });

            if (!res.ok) {
                if (res.status === 401) throw new Error("Invalid API Key");
                throw new Error("Failed to fetch emails");
            }

            const data = await res.json() as Email[];
            setEmails(data);
            setSelectedIds(new Set());
        } catch (err: any) {
            setError(err.message);
            if (err.message === "Invalid API Key") logout();
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev";
            const res = await fetch(`${WORKER_URL}/api/v1/admin/stats`, { headers: { 'X-API-Key': apiKey } });
            const data = await res.json();
            setStats(data);
        } catch (e) { alert("Failed to fetch stats"); }
        finally { setLoading(false); }
    };

    const fetchBlocklist = async () => {
        setLoading(true);
        try {
            const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev";
            const res = await fetch(`${WORKER_URL}/api/v1/admin/blocklist`, { headers: { 'X-API-Key': apiKey } });
            const data = await res.json();
            setBlocklist(data);
        } catch (e) { alert("Failed to fetch blocklist"); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        if (activeTab === 'inbox') fetchEmails(apiKey, search);
        if (activeTab === 'stats') fetchStats();
        if (activeTab === 'settings') fetchBlocklist();
    }, [activeTab]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchEmails(apiKey, search);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === emails.length && emails.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(emails.map(e => e.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const deleteEmail = async (id: string) => {
        if (!confirm("Are you sure you want to delete this email?")) return;
        await performDelete([id]);
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Delete ${selectedIds.size} emails? This cannot be undone.`)) return;
        await performDelete(Array.from(selectedIds));
    };

    const performDelete = async (ids: string[]) => {
        setIsDeleting(true);
        try {
            const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev";

            const res = await fetch(`${WORKER_URL}/api/v1/admin/emails/delete`, {
                method: 'POST',
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids })
            });

            if (res.ok) {
                setEmails(emails.filter(e => !ids.includes(e.id)));
                setSelectedIds(new Set());
            } else {
                if (ids.length === 1) {
                    const resSingle = await fetch(`${WORKER_URL}/api/v1/admin/email/${ids[0]}`, {
                        method: 'DELETE',
                        headers: { 'X-API-Key': apiKey }
                    });
                    if (resSingle.ok) {
                        setEmails(emails.filter(e => e.id !== ids[0]));
                        setSelectedIds(new Set());
                    } else {
                        throw new Error("Failed to delete");
                    }
                } else {
                    throw new Error("Batch delete failed");
                }
            }
        } catch (e) {
            alert("Error deleting emails");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleExport = () => {
        const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev";
        window.open(`${WORKER_URL}/api/v1/admin/export?key=${apiKey}`, '_blank');
        // Note: passing key in query param for simple window.open download. 
        // Security constraint: Better to fetchBlob but window.open is easiest for MVP.
        // Wait, index.ts checks HEADER. Query param won't work unless I allow it.
        // Let's implement fetchBlob download instead.
        downloadExport();
    };

    const downloadExport = async () => {
        const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev";
        try {
            const res = await fetch(`${WORKER_URL}/api/v1/admin/export`, {
                headers: { 'X-API-Key': apiKey }
            });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vmail-export-${new Date().toISOString()}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) { alert("Download failed"); }
    };

    const addToBlocklist = async () => {
        if (!newBlock.includes('@')) return alert("Enter valid email or @domain");
        try {
            const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev";
            await fetch(`${WORKER_URL}/api/v1/admin/blocklist`, {
                method: 'POST',
                headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newBlock })
            });
            setNewBlock('');
            fetchBlocklist();
        } catch (e) { alert("Failed to block"); }
    };

    const removeFromBlocklist = async (email: string) => {
        if (!confirm(`Unblock ${email}?`)) return;
        try {
            const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || "https://emails-worker.trung27031.workers.dev";
            await fetch(`${WORKER_URL}/api/v1/admin/blocklist?email=${encodeURIComponent(email)}`, {
                method: 'DELETE',
                headers: { 'X-API-Key': apiKey }
            });
            fetchBlocklist();
        } catch (e) { alert("Failed to unblock"); }
    };

    if (!isAuthenticated) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-card border border-border rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Admin Login</h2>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">API Key</label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full p-2 rounded border bg-background"
                            placeholder="Enter API Key"
                        />
                    </div>
                    <button type="submit" className="w-full bg-primary text-primary-foreground p-2 rounded hover:opacity-90">
                        Login
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-card p-4 rounded border gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold">Admin Dashboard</h2>
                    <div className="flex bg-muted rounded p-1">
                        <button onClick={() => setActiveTab('inbox')} className={`px-3 py-1 text-xs rounded transition-all ${activeTab === 'inbox' ? 'bg-background shadow font-medium' : 'hover:bg-background/50'}`}>Inbox</button>
                        <button onClick={() => setActiveTab('stats')} className={`px-3 py-1 text-xs rounded transition-all ${activeTab === 'stats' ? 'bg-background shadow font-medium' : 'hover:bg-background/50'}`}>Stats</button>
                        <button onClick={() => setActiveTab('settings')} className={`px-3 py-1 text-xs rounded transition-all ${activeTab === 'settings' ? 'bg-background shadow font-medium' : 'hover:bg-background/50'}`}>Settings</button>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto justify-end">
                    <button onClick={downloadExport} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                        <span>💾</span> Export Data
                    </button>
                    <button onClick={logout} className="px-3 py-1 text-sm border text-muted-foreground rounded hover:bg-muted">Logout</button>
                </div>
            </div>

            {error && <div className="p-4 bg-destructive/10 text-destructive rounded">{error}</div>}

            {/* INBOX TAB */}
            {activeTab === 'inbox' && (
                <>
                    <div className="flex justify-between mb-4">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="px-3 py-1 text-sm border rounded bg-background w-64"
                            />
                            <button type="submit" className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90">Search</button>
                        </form>
                        <div className="flex gap-2">
                            <button onClick={() => fetchEmails(apiKey, search)} className="px-3 py-1 text-sm border rounded hover:bg-muted">Refresh</button>
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={deleteSelected}
                                    disabled={isDeleting}
                                    className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded hover:opacity-90"
                                >
                                    {isDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-10">Loading emails...</div>
                    ) : (
                        <div className="overflow-x-auto bg-card border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-4 py-3 w-10">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.size === emails.length && emails.length > 0}
                                                onChange={toggleSelectAll}
                                                className="translate-y-0.5"
                                            />
                                        </th>
                                        <th className="px-4 py-3">To</th>
                                        <th className="px-4 py-3">From</th>
                                        <th className="px-4 py-3">Subject</th>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {emails.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No emails found</td>
                                        </tr>
                                    ) : (
                                        emails.map(email => (
                                            <tr key={email.id} className={`border-b border-border hover:bg-muted/50 ${selectedIds.has(email.id) ? 'bg-muted/30' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(email.id)}
                                                        onChange={() => toggleSelect(email.id)}
                                                        className="translate-y-0.5"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-medium">{email.messageTo}</td>
                                                <td className="px-4 py-3">{email.messageFrom}</td>
                                                <td className="px-4 py-3 truncate max-w-xs">{email.subject}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{new Date(email.createdAt).toLocaleString()}</td>
                                                <td className="px-4 py-3 flex gap-2">
                                                    <button onClick={() => setSelectedEmail(email)} className="text-primary hover:underline">View</button>
                                                    <button onClick={() => deleteEmail(email.id)} className="text-destructive hover:underline">Delete</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* STATS TAB */}
            {activeTab === 'stats' && (
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-card border rounded p-4">
                        <h3 className="font-semibold mb-4">Top Targets (Received)</h3>
                        {stats?.receivers ? (
                            <ul className="space-y-2">
                                {stats.receivers.map((r, i) => (
                                    <li key={i} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                                        <span className="font-mono">{r.address}</span>
                                        <span className="font-bold">{r.count}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : <div className="text-muted-foreground text-sm">Loading...</div>}
                    </div>
                    <div className="bg-card border rounded p-4">
                        <h3 className="font-semibold mb-4">Top Senders</h3>
                        {stats?.senders ? (
                            <ul className="space-y-2">
                                {stats.senders.map((s, i) => (
                                    <li key={i} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0 items-center">
                                        <div className="truncate max-w-[180px] md:max-w-[300px]" title={s.address}>
                                            {s.address}
                                        </div>
                                        <span className="font-bold flex-shrink-0 ml-2">{s.count}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : <div className="text-muted-foreground text-sm">Loading...</div>}
                    </div>
                </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
                <div className="bg-card border rounded p-4 max-w-2xl mx-auto">
                    <h3 className="font-semibold mb-4">Blocklist Manager</h3>
                    <p className="text-sm text-muted-foreground mb-4">Emails from these addresses will be rejected automatically. Use <code>@domain.com</code> to block an entire domain.</p>

                    <div className="flex gap-2 mb-6">
                        <input
                            className="flex-1 p-2 border rounded bg-background"
                            placeholder="e.g. spammer@bad.com or @ad-network.com"
                            value={newBlock}
                            onChange={e => setNewBlock(e.target.value)}
                        />
                        <button onClick={addToBlocklist} className="bg-destructive text-white px-4 py-2 rounded hover:opacity-90">Block</button>
                    </div>

                    <div className="space-y-2">
                        {blocklist.length === 0 ? <div className="text-center text-muted-foreground py-4">Blocklist is empty</div> :
                            blocklist.map(item => (
                                <div key={item.email} className="flex justify-between items-center p-2 bg-muted/30 rounded border border-border/50">
                                    <div>
                                        <div className="font-mono text-sm">{item.email}</div>
                                        <div className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <button onClick={() => removeFromBlocklist(item.email)} className="text-xs border px-2 py-1 rounded hover:bg-background">Unblock</button>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {selectedEmail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-background w-full max-w-4xl max-h-[90vh] rounded-lg shadow-xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="font-semibold text-lg truncate pr-4">{selectedEmail.subject || '(No Subject)'}</h3>
                            <button
                                onClick={() => setSelectedEmail(null)}
                                className="p-1 hover:bg-muted rounded text-muted-foreground"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <EmailViewer email={selectedEmail} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminPanel() {
    return (
        <ErrorBoundary>
            <AdminPanelContent />
        </ErrorBoundary>
    );
}
