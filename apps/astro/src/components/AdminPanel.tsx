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
    const [apiKey, setApiKey] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
            setSelectedIds(new Set()); // Reset selection on refresh/search
        } catch (err: any) {
            setError(err.message);
            if (err.message === "Invalid API Key") logout();
        } finally {
            setLoading(false);
        }
    };

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
                // Fallback for single delete
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-card p-4 rounded border gap-4">
                <h2 className="text-lg font-semibold">Admin Dashboard</h2>

                <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Search sender, subject..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="px-3 py-1 text-sm border rounded bg-background flex-1 md:w-64"
                    />
                    <button type="submit" className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90">
                        Search
                    </button>
                </form>

                <div className="flex gap-2">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={deleteSelected}
                            disabled={isDeleting}
                            className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded hover:opacity-90"
                        >
                            {isDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                        </button>
                    )}
                    <button onClick={() => fetchEmails(apiKey, search)} className="px-3 py-1 text-sm border rounded hover:bg-muted">Refresh</button>
                    <button onClick={logout} className="px-3 py-1 text-sm border text-muted-foreground rounded hover:bg-muted">Logout</button>
                </div>
            </div>

            {error && <div className="p-4 bg-destructive/10 text-destructive rounded">{error}</div>}

            {loading ? (
                <div className="text-center py-10">Loading...</div>
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
                                        <td className="px-4 py-3">{email.sender}</td>
                                        <td className="px-4 py-3 truncate max-w-xs">{email.subject}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(email.createdAt).toLocaleString()}</td>
                                        <td className="px-4 py-3 flex gap-2">
                                            <button
                                                onClick={() => setSelectedEmail(email)}
                                                className="text-primary hover:underline"
                                            >
                                                View
                                            </button>
                                            <button
                                                onClick={() => deleteEmail(email.id)}
                                                className="text-destructive hover:underline"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
