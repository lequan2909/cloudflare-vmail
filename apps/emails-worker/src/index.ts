/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import PostalMime from "postal-mime";
import { Hono, Context } from "hono";
import { cors } from "hono/cors";
import { InsertEmail, insertEmailSchema, blockedSenders, emails as emailTable } from "database/schema";
import { insertEmail, getEmails, getEmail, getEmailsByMessageTo } from "database/dao";
import { getCloudflareD1 } from "database/db";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

type Bindings = Env & {
	DB: D1Database;
	API_KEY: string;
	TELEGRAM_BOT_TOKEN?: string;
	TELEGRAM_ID?: string; // Master ID for all emails
	MAIL_DOMAIN?: string;
	OPENAI_API_KEY?: string;
	OPENAI_CHAT_MODEL?: string;
	OPENAI_COMPLETIONS_API?: string;
	SUMMARY_TARGET_LANG?: string;
	SEND_PROVIDER_URL?: string;
	SEND_PROVIDER_KEY?: string;
	MAIL_SENDER?: string;
	BACKUP_EMAIL?: string;
	[key: string]: any; // Allow dynamic access for MAIL_SENDER_n
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

// Middleware to check API Key
app.use("/api/*", async (c, next) => {
	const path = c.req.path;
	// Skip for Telegram Webhook and Public Endpoints
	if (path.includes("/api/telegram") || path.includes("/api/v1/domains")) {
		return await next();
	}

	const apiKey = c.req.header("X-API-Key");
	const envApiKey = c.env.API_KEY;

	if (!envApiKey || apiKey !== envApiKey) {
		// Only check if key is set in env, otherwise allow for dev or warn
		if (envApiKey) return c.json({ error: "Unauthorized" }, 401);
	}
	await next();
});

// --- HELPER FUNCTIONS ---

// Database Helper for Blocklist
async function isSenderBlocked(db: ReturnType<typeof getCloudflareD1>, email: string): Promise<boolean> {
	try {
		const result = await db.select().from(blockedSenders).where(eq(blockedSenders.email, email)).get();
		return !!result;
	} catch (e) {
		console.error("Error checking blocklist:", e);
		return false;
	}
}

async function blockSender(db: ReturnType<typeof getCloudflareD1>, email: string) {
	try {
		await db.insert(blockedSenders).values({
			email,
			createdAt: new Date(),
			reason: "User blocked via Telegram"
		}).onConflictDoNothing().run();
	} catch (e) {
		console.error("Error blocking sender:", e);
	}
}

async function whitelistSender(db: ReturnType<typeof getCloudflareD1>, email: string) {
	try {
		await db.delete(blockedSenders).where(eq(blockedSenders.email, email)).run();
	} catch (e) {
		console.error("Error whitelisting sender:", e);
	}
}

async function deleteEmail(db: ReturnType<typeof getCloudflareD1>, id: string) {
	try {
		await db.delete(emailTable).where(eq(emailTable.id, id)).run();
	} catch (e) {
		console.error("Error deleting email:", e);
	}
}

async function updateEmailSummary(db: ReturnType<typeof getCloudflareD1>, id: string, summary: string) {
	try {
		await db.update(emailTable).set({ summary }).where(eq(emailTable.id, id)).run();
	} catch (e) {
		console.error("Error updating summary:", e);
	}
}


// Telegram Helpers
async function sendTelegramMessage(token: string, chatId: number, text: string, allowHtml: boolean = false, keyboard?: any) {
	const body: any = {
		chat_id: chatId,
		text,
		parse_mode: allowHtml ? "HTML" : undefined,
	};
	if (keyboard) {
		body.reply_markup = keyboard;
	}

	await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

async function editTelegramMessage(token: string, chatId: number, messageId: number, text: string, allowHtml: boolean = false, keyboard?: any) {
	const body: any = {
		chat_id: chatId,
		message_id: messageId,
		text: text,
		parse_mode: allowHtml ? "HTML" : undefined,
	};
	if (keyboard) {
		body.reply_markup = keyboard;
	}

	await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
	await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
	});
}


// OpenAI Helper
async function callOpenAI(apiKey: string, prompt: string, content: string, baseUrl: string = "https://api.openai.com/v1/chat/completions", model: string = "gpt-4o-mini") {
	try {
		const response = await fetch(baseUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: model,
				messages: [
					{ role: "system", content: "You are a helpful assistant. Output concise summary." },
					{ role: "user", content: `${prompt}\n\nContent:\n${content.substring(0, 3000)}` }
				],
				max_tokens: 150
			})
		});
		const data: any = await response.json();
		//@ts-ignore
		return data.choices?.[0]?.message?.content || "AI Analysis failed.";
	} catch (e) {
		return "AI Service Unavailable";
	}
}

// Helper to get Provider Config based on Sender Domain
function getProviderConfig(env: Bindings, sender: string): { url: string, key: string } {
	const defaultUrl = env.SEND_PROVIDER_URL || "https://api.resend.com/emails";
	const defaultKey = env.SEND_PROVIDER_KEY || "";

	if (!sender) return { url: defaultUrl, key: defaultKey };

	const senderDomain = sender.split("@")[1]?.trim().toLowerCase();
	if (!senderDomain) return { url: defaultUrl, key: defaultKey };

	// Check up to 5 custom providers
	for (let i = 1; i <= 5; i++) {
		const senderList = (env[`MAIL_SENDER_${i}`] as string) || "";
		if (senderList) {
			const domains = senderList.split(",").map(d => d.trim().toLowerCase());
			if (domains.includes(senderDomain) || domains.includes(sender.toLowerCase())) {
				const url = (env[`SEND_PROVIDER_URL_${i}`] as string) || defaultUrl;
				const key = (env[`SEND_PROVIDER_KEY_${i}`] as string) || defaultKey;
				return { url, key };
			}
		}
	}

	return { url: defaultUrl, key: defaultKey };
}

// Email Sending Helper (now an API endpoint)
app.post("/api/v1/send", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	try {
		const { to, subject, content, from } = await c.req.json<any>();
		if (!to || !subject || !content) return c.json({ error: "Missing fields" }, 400);

		// Determine Sender
		// If 'from' is provided (e.g. "Name <user@domain.com>"), extract address. 
		// Or use default MAIL_SENDER if not provided.
		let senderAddress = c.env.MAIL_SENDER || "noreply@docxs.online";

		if (from) {
			// Extract email from "Name <email>" format if present
			const match = from.match(/<(.+)>/);
			senderAddress = match ? match[1] : from;
		}

		// Get Dynamic Provider
		const provider = getProviderConfig(c.env, senderAddress);

		const res = await fetch(provider.url, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${provider.key}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				from: from || c.env.MAIL_SENDER, // Pass original "Name <email>" if possible, or default
				to: [to],
				subject,
				html: content
			})
		});

		if (res.ok) {
			return c.json({ success: true, provider: provider.url }); // Return provider for debug
		} else {
			const errorText = await res.text();
			return c.json({ error: `Provider Error: ${errorText}` }, 500);
		}
	} catch (e: any) {
		return c.json({ error: e.message }, 500);
	}
});


// --- ROUTES ---

// Telegram Webhook Handler
app.post("/api/telegram/webhook", async (c: Context<{ Bindings: Bindings }>) => {
	const token = c.env.TELEGRAM_BOT_TOKEN;
	if (!token) return c.json({ error: "Telegram token not configured" }, 500);

	const update = await c.req.json();
	const db = getCloudflareD1(c.env.DB);

	// Handle Callback Queries (Buttons)
	if (update.callback_query) {
		const query = update.callback_query;
		const chatId = query.message.chat.id;
		const messageId = query.message.message_id;
		const data = query.data; // e.g., "view:emailId", "del:emailId", "blk:email"
		const [action, target] = data.split(":");

		try {
			// Helper to get Back Button
			const getBackKeyboard = (id: string) => ({
				inline_keyboard: [[{ text: "🔙 Back", callback_data: `back:${id}` }]]
			});

			if (action === "back") {
				const email = await getEmail(db, target);
				if (!email) {
					await editTelegramMessage(token, chatId, messageId, "❌ Email not found (deleted).");
				} else {
					const from = email.messageFrom; // Simplified
					const to = email.messageTo;
					const subject = email.subject || "(No Subject)";

					const headerMsg = `📬 *New Email*\n` +
						`Subject: ${subject}\n` +
						`From: ${from}\n` +
						`To: ${to}\n` +
						`Received: ${new Date(email.createdAt).toLocaleString()}\n`;

					const keyboard = {
						inline_keyboard: [
							[
								{ text: "👁️ Preview", callback_data: `preview:${email.id}` },
								{ text: "📝 Summary", callback_data: `summary:${email.id}` }
							],
							[
								{ text: "📄 Text", callback_data: `text:${email.id}` },
								{ text: "🌐 HTML", callback_data: `html:${email.id}` }
							],
							[
								{ text: "🚫 Block Sender", callback_data: `blk:${from}` },
								{ text: "✅ Whitelist Sender", callback_data: `wht:${from}` }
							]
						]
					};
					await editTelegramMessage(token, chatId, messageId, headerMsg, false, keyboard);
				}
			}
			else if (action === "preview") {
				const email = await getEmail(db, target);
				if (email) {
					const content = (email.text || email.html || "").substring(0, 500);
					await editTelegramMessage(token, chatId, messageId, `👁️ *Preview:*\n\n${content}...`, false, getBackKeyboard(target));
				}
			}
			else if (action === "summary") {
				const email = await getEmail(db, target);
				if (email) {
					let summary = email.summary;
					if (!summary && c.env.OPENAI_API_KEY) {
						await answerCallbackQuery(token, query.id, "Generating summary...");
						const lang = c.env.SUMMARY_TARGET_LANG || "English";
						summary = await callOpenAI(
							c.env.OPENAI_API_KEY,
							`Summarize this email in 1-2 sentences in ${lang}.`,
							email.text || email.html || "",
							c.env.OPENAI_COMPLETIONS_API,
							c.env.OPENAI_CHAT_MODEL
						);
						await updateEmailSummary(db, target, summary);
					}
					await editTelegramMessage(token, chatId, messageId, `📝 *AI Summary:*\n\n${summary || "Not available"}`, false, getBackKeyboard(target));
				}
			}
			else if (action === "text") {
				const email = await getEmail(db, target);
				if (email) {
					// Telegram limits to ~4096. Safety margin.
					const content = (email.text || "No text content").substring(0, 3000);
					await editTelegramMessage(token, chatId, messageId, `📄 *Full Text:*\n\n${content}`, false, getBackKeyboard(target));
				}
			}
			else if (action === "html") {
				const email = await getEmail(db, target);
				if (email) {
					const content = email.html || "No HTML content";
					const blob = new Blob([content], { type: 'text/html' });
					const formData = new FormData();
					formData.append('chat_id', chatId.toString());
					formData.append('document', blob, `email-${target}.html`);
					formData.append('caption', '🌐 HTML Source');

					await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
						method: "POST",
						body: formData
					});
					await answerCallbackQuery(token, query.id, "Sent as file 👇");
				}
			}
			else if (action === "del") {
				await deleteEmail(db, target);
				await editTelegramMessage(token, chatId, messageId, "🗑️ Email deleted.");
			}
			else if (action === "blk") {
				await blockSender(db, target);
				await answerCallbackQuery(token, query.id, `🚫 Blocked: ${target}`);
			}
			else if (action === "wht") {
				await whitelistSender(db, target);
				await answerCallbackQuery(token, query.id, `✅ Whitelisted: ${target}`);
			}
			else if (action.startsWith("unblock_list")) {
				// Manage unblocking from list
				await whitelistSender(db, target);
				await editTelegramMessage(token, chatId, messageId, `✅ Unblocked ${target}. List updated.`);
				// Ideally refresh list?? Too complex for now.
			}

			await answerCallbackQuery(token, query.id);

		} catch (e) {
			console.error(e);
		}
		return c.json({ ok: true });
	}

	if (!update.message || !update.message.text) return c.json({ ok: true });

	const chatId = update.message.chat.id;
	const text = update.message.text.trim();

	// Basic Commands
	try {
		if (text === "/start") {
			await sendTelegramMessage(token, chatId, "👋 Welcome to vMail Bot!\nManaged by Cloudflare Workers.");
		} else if (text === "/new") {
			const domainStr = c.env.MAIL_DOMAIN || "example.com";
			const domains = domainStr.split(",").map(d => d.trim());
			const domain = domains[Math.floor(Math.random() * domains.length)];

			const randomId = nanoid(8);
			const emailAddress = `${randomId}@${domain}`;
			await sendTelegramMessage(token, chatId, `📧 New Address: \`${emailAddress}\``);
		} else if (text === "/blocklist") {
			const list = await db.select().from(blockedSenders).all();
			if (list.length === 0) {
				await sendTelegramMessage(token, chatId, "✅ Blocklist is empty.");
			} else {
				let msg = "🚫 **Blocked Senders:**\n\n";
				const keyboardRows = [];
				for (const item of list) {
					msg += `- \`${item.email}\`\n`;
					keyboardRows.push([{ text: `🔓 Unblock ${item.email}`, callback_data: `wht:${item.email}` }]);
				}
				// Split into chunks if too many rows? For now Limit to 10 recent
				const keyboard = { inline_keyboard: keyboardRows.slice(0, 10) };
				await sendTelegramMessage(token, chatId, msg, false, keyboard);
			}
		} else if (text.startsWith("/check")) {
			const parts = text.split(" ");
			const address = parts[1];
			if (!address) {
				await sendTelegramMessage(token, chatId, "Usage: `/check <address>`");
			} else {
				const emails = await getEmailsByMessageTo(db, address);
				if (emails.length === 0) {
					await sendTelegramMessage(token, chatId, `📭 Box ${address} is empty.`);
				} else {
					let msg = `📬 **Inbox ${address}:**\n`;
					for (const email of emails.slice(0, 5)) {
						msg += `\n🆔 \`${email.id}\`\nFROM: ${email.messageFrom}\nSUBJ: ${email.subject}\n----------------`;
					}
					await sendTelegramMessage(token, chatId, msg);
				}
			}
		}
	} catch (e) {
		console.error(e);
	}

	return c.json({ ok: true });
});

// AI Summarize Endpoint (Optional external call)
app.get("/api/v1/ai/summarize/:id", async (c: Context) => {
	const id = c.req.param("id");
	const openAIKey = c.env.OPENAI_API_KEY;
	if (!openAIKey) return c.json({ error: "OpenAI not configured" }, 500);

	const db = getCloudflareD1(c.env.DB);
	const email = await getEmail(db, id);
	if (!email) return c.json({ error: "Email not found" }, 404);

	const content = email.text || email.html || "No content";
	const result = await callOpenAI(openAIKey, "Summarize this email.", content, c.env.OPENAI_COMPLETIONS_API, c.env.OPENAI_CHAT_MODEL);
	return c.json({ summary: result });
});


app.get("/api/v1/domains", (c) => {
	const domains = new Set<string>();

	// 1. Add from MAIL_DOMAIN
	if (c.env.MAIL_DOMAIN) {
		c.env.MAIL_DOMAIN.split(",").forEach(d => domains.add(d.trim()));
	}

	// 2. Add from MAIL_SENDER (default)
	if (c.env.MAIL_SENDER) {
		const parts = c.env.MAIL_SENDER.split("@");
		if (parts.length === 2) domains.add(parts[1].trim());
	}

	// 3. Add from MAIL_SENDER_n
	for (let i = 1; i <= 5; i++) {
		const senderList = (c.env[`MAIL_SENDER_${i}`] as string) || "";
		if (senderList) {
			senderList.split(",").forEach(d => {
				const trimmed = d.trim();
				if (trimmed.includes("@")) {
					domains.add(trimmed.split("@")[1]);
				} else {
					domains.add(trimmed);
				}
			});
		}
	}

	return c.json({ domains: Array.from(domains).sort() });
});

// Automation API Endpoints
app.get("/api/v1/inbox/:address", async (c) => {
	const address = c.req.param("address");
	const db = getCloudflareD1(c.env.DB);
	return c.json(await getEmailsByMessageTo(db, address));
});

app.get("/api/v1/message/:id", async (c) => {
	const id = c.req.param("id");
	const db = getCloudflareD1(c.env.DB);
	const email = await getEmail(db, id);
	if (!email) return c.json({ error: "Email not found" }, 404);
	return c.json(email);
});

app.get("/api/v1/latest/:address", async (c) => {
	const address = c.req.param("address");
	const db = getCloudflareD1(c.env.DB);
	const emails = await getEmailsByMessageTo(db, address);
	if (!emails[0]) return c.json({ message: "No email found" }, 404);
	return c.json(emails[0]);
});


export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		const bindings = env as Bindings;
		try {
			const db = getCloudflareD1(bindings.DB);
			const messageFrom = message.from;

			// 1. Blocklist Check
			if (await isSenderBlocked(db, messageFrom)) {
				console.log(`Blocked email from: ${messageFrom}`);
				message.setReject("Sender is blocked");
				return;
			}

			// 2. Parse Email
			const rawText = await new Response(message.raw).text();
			const mail = await new PostalMime().parse(rawText);
			const now = new Date();

			// 3. Catch-all & Forward to Backup
			if (bindings.BACKUP_EMAIL) {
				try {
					await message.forward(bindings.BACKUP_EMAIL);
				} catch (fwErr) {
					console.error("Backup forward failed:", fwErr);
				}
			}

			// 4. Save to Database
			const newEmail: InsertEmail = {
				id: nanoid(),
				messageFrom,
				messageTo: message.to,
				...mail,
				from: {
					address: typeof mail.from === 'object' ? (mail.from?.address || "unknown") : "unknown",
					name: typeof mail.from === 'object' ? (mail.from?.name || "") : ""
				},
				sender: mail.sender ? {
					address: mail.sender.address || "unknown",
					name: mail.sender.name || ""
				} : undefined,
				replyTo: mail.replyTo?.map(a => ({
					address: a.address || "unknown",
					name: a.name || ""
				})),
				to: mail.to?.map(a => ({
					address: a.address || "unknown",
					name: a.name || ""
				})),
				cc: mail.cc?.map(a => ({
					address: a.address || "unknown",
					name: a.name || ""
				})),
				bcc: mail.bcc?.map(a => ({
					address: a.address || "unknown",
					name: a.name || ""
				})),
				createdAt: now,
				updatedAt: now,
			};
			const email = insertEmailSchema.parse(newEmail);
			await insertEmail(db, email);

			// 5. Telegram Notification (Rich Buttons)
			const tgToken = bindings.TELEGRAM_BOT_TOKEN;
			const tgId = bindings.TELEGRAM_ID;

			if (tgToken && tgId) {
				const subject = mail.subject || "(No Subject)";
				const from = typeof mail.from === 'string' ? mail.from : (mail.from?.address || "Unknown");
				const to = typeof mail.to === 'string' ? mail.to : (mail.to?.[0]?.address || "Unknown");

				// Header only message
				const alertMsg = `📬 *New Email*\n` +
					`Subject: ${subject}\n` +
					`From: ${from}\n` +
					`To: ${to}\n` +
					`Received: ${now.toLocaleString()}\n`;

				const keyboard = {
					inline_keyboard: [
						[
							{ text: "👁️ Preview", callback_data: `preview:${newEmail.id}` },
							{ text: "📝 Summary", callback_data: `summary:${newEmail.id}` }
						],
						[
							{ text: "📄 Text", callback_data: `text:${newEmail.id}` },
							{ text: "🌐 HTML", callback_data: `html:${newEmail.id}` }
						],
						[
							{ text: "🚫 Block Sender", callback_data: `blk:${messageFrom}` },
							{ text: "✅ Whitelist Sender", callback_data: `wht:${messageFrom}` }
						]
					]
				};

				// Broadcast to all master IDs
				const ids = tgId.split(",");
				for (const id of ids) {
					await sendTelegramMessage(tgToken, parseInt(id.trim()), alertMsg, false, keyboard);
				}
			}

		} catch (e) {
			console.error("Email Worker Error:", e);
		}
	},
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return app.fetch(request, env, ctx);
	}
} satisfies ExportedHandler<Env>;
