import { useState } from 'react';

export default function SendEmailModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        apiKey: '',
        fromName: '',
        fromUser: '',
        to: '',
        subject: '',
        content: '',
        workerUrl: ''
    });
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const [domains, setDomains] = useState<string[]>([]);
    const [selectedDomain, setSelectedDomain] = useState('docxs.online');

    // Fetch domains on load
    useState(() => {
        const fetchDomains = async () => {
            const url = formData.workerUrl || 'https://emails-worker.trung27031.workers.dev/api/v1/domains';
            try {
                const res = await fetch(url);
                const data = await res.json();
                if (data.domains && data.domains.length > 0) {
                    setDomains(data.domains);
                    setSelectedDomain(data.domains[0]);
                }
            } catch (e) {
                console.error("Failed to load domains", e);
                setDomains(['docxs.online']);
            }
        };
        fetchDomains();
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        const fullFrom = formData.fromUser ? `${formData.fromUser}@${selectedDomain}` : undefined;

        try {
            const res = await fetch(formData.workerUrl || 'https://emails-worker.trung27031.workers.dev/api/v1/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': formData.apiKey
                },
                body: JSON.stringify({
                    to: formData.to,
                    subject: formData.subject,
                    content: formData.content,
                    from: fullFrom ? `${formData.fromName} <${fullFrom}>` : undefined
                })
            });

            const data: any = await res.json();
            if (res.ok && data.success) {
                setStatus({ type: 'success', msg: 'Email sent successfully!' });
                setTimeout(() => setIsOpen(false), 2000);
            } else {
                setStatus({ type: 'error', msg: data.error || 'Failed to send' });
            }
        } catch (err) {
            setStatus({ type: 'error', msg: 'Network error' });
        }
        setLoading(false);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-primary text-primary-foreground hover:bg-primary/90 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all z-50"
                title="Compose Email"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card text-card-foreground w-full max-w-lg rounded-lg shadow-xl border border-border p-6 relative">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <h2 className="text-xl font-semibold mb-4">Compose Email (Admin)</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">API Key (Password)</label>
                        <input
                            type="password"
                            required
                            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-ring"
                            value={formData.apiKey}
                            onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                            placeholder="Enter API Key to authenticate"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">From Name</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-background border border-input rounded-md"
                                value={formData.fromName}
                                onChange={e => setFormData({ ...formData, fromName: e.target.value })}
                                placeholder="e.g. Admin"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">From Address</label>
                            <div className="flex">
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-background border border-input rounded-l-md"
                                    value={formData.fromUser}
                                    onChange={e => setFormData({ ...formData, fromUser: e.target.value })}
                                    placeholder="admin"
                                />
                                <select
                                    className="px-2 py-2 bg-muted border border-l-0 border-input rounded-r-md text-sm outline-none focus:ring-2 focus:ring-ring"
                                    value={selectedDomain}
                                    onChange={e => setSelectedDomain(e.target.value)}
                                >
                                    {domains.map(d => (
                                        <option key={d} value={d}>@{d}</option>
                                    ))}
                                    {domains.length === 0 && <option value="docxs.online">@docxs.online</option>}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">To</label>
                        <input
                            type="email"
                            required
                            className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            value={formData.to}
                            onChange={e => setFormData({ ...formData, to: e.target.value })}
                            placeholder="recipient@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Subject</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            value={formData.subject}
                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Content (HTML allowed)</label>
                        <textarea
                            required
                            rows={5}
                            className="w-full px-3 py-2 bg-background border border-input rounded-md font-mono text-sm"
                            value={formData.content}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                        />
                    </div>

                    <div>
                        <details className="mt-2 text-xs text-muted-foreground cursor-pointer">
                            <summary>Advanced Settings</summary>
                            <div className="mt-2">
                                <label className="block text-sm font-medium mb-1">Worker URL</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-background border border-input rounded-md"
                                    value={formData.workerUrl || 'https://emails-worker.trung27031.workers.dev/api/v1/send'}
                                    onChange={e => setFormData({ ...formData, workerUrl: e.target.value })}
                                    placeholder="https://emails-worker.trung27031.workers.dev/api/v1/send"
                                />
                            </div>
                        </details>
                    </div>

                    {status && (
                        <div className={`p-3 rounded-md text-sm ${status.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {status.msg}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md disabled:opacity-50"
                        >
                            {loading ? 'Sending...' : 'Send Email'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
