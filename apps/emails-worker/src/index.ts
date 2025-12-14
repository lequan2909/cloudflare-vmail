
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
import { InsertEmail, insertEmailSchema, blockedSenders, emails as emailTable, InsertAttachment, attachments } from "database/schema";
import { getCloudflareD1 } from "database/db";
// @ts-ignore
import { insertEmail, getEmails, getEmail, getEmailsByMessageTo, insertAttachment, getEmailsToDelete, getAttachmentsByEmailId, deleteEmail, deleteAttachmentsByEmailId, getAllEmails, deleteEmails, getAttachmentsByEmailIds, deleteAttachmentsByEmailIds, getSenderStats, getReceiverStats, getAllEmailsForExport, getBlockedSenders, addBlockedSender, removeBlockedSender, isSenderBlocked } from "database/dao";

import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

type Bindings = Env & {
	R2: R2Bucket;
	WORKER_URL?: string;
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
	WEBHOOK_URL?: string;
	MAX_EMAILS?: string;
	[key: string]: any; // Allow dynamic access for MAIL_SENDER_n
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

// Middleware to check API Key
app.use("/api/*", async (c, next) => {
	const path = c.req.path;
	// Skip for Telegram Webhook and Public Endpoints
	if (path.includes("/api/telegram") || path.includes("/api/v1/domains") || path.includes("/api/v1/attachments")) {
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

// --- HELPER FUNCTIONS ---

// Database Helper for Blocklist checks moved to DAO (isSenderBlocked)
// Local wrapper for logging if needed, or directly use DAO
// But we keep telegram helper functions using DAO

async function blockSenderCaller(db: ReturnType<typeof getCloudflareD1>, email: string) {
	try {
		// @ts-ignore
		await addBlockedSender(db, email, "User blocked via Telegram");
	} catch (e) {
		console.error("Error blocking sender:", e);
	}
}

async function whitelistSenderCaller(db: ReturnType<typeof getCloudflareD1>, email: string) {
	try {
		// @ts-ignore
		await removeBlockedSender(db, email);
	} catch (e) {
		console.error("Error whitelisting sender:", e);
	}
}

async function deleteEmail(db: ReturnType<typeof getCloudflareD1>, id: string) {
	try {
		// @ts-ignore
		await (db as any).delete(emailTable).where(eq(emailTable.id, id)).run();
	} catch (e) {
		console.error("Error deleting email:", e);
	}
}

// OTP Extraction Helper
function extractOtp(subject: string, body: string): string | null {
	try {
		const combined = `${subject} ${body || ""}`;
		// Limit length to avoid regex DDOS on massive emails
		const searchArea = combined.substring(0, 5000);
		// Regex: Match common keywords followed by 4-8 digits.
		const otpRegex = /(?:code|otp|verify|verification|pin|secret|mã|xác\s?thực|số|login).*?(\b\d{4,8}\b)/is;
		const match = searchArea.match(otpRegex);
		return (match && match[1]) ? match[1] : null; // Fixed type
	} catch (e) {
		console.error("OTP Extraction Error:", e);
		return null;
	}
}

async function updateEmailSummary(db: ReturnType<typeof getCloudflareD1>, id: string, summary: string) {
	try {
		// TODO: Add summary column to emails table first
		// await db.update(emailTable).set({ summary }).where(eq(emailTable.id, id)).run();
	} catch (e) {
		console.error("Error updating summary:", e);
	}
}


// Telegram Helpers
// Telegram Helpers
async function sendTelegramMessage(token: string, chatId: number, text: string, allowHtml: boolean = false, keyboard?: any) {
	const body: any = {
		chat_id: chatId,
		text: text.substring(0, 4000), // Safety clip
		parse_mode: allowHtml ? "HTML" : undefined,
	};
	if (keyboard) {
		body.reply_markup = keyboard;
	}

	try {
		const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			const err = await res.text();
			console.error(`Telegram Send Error: ${res.status} ${err}`, JSON.stringify(body));
		}
	} catch (e) {
		console.error("Telegram Network Error:", e);
	}
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
// OpenAI Helper
async function callOpenAI(apiKey: string, prompt: string, content: string, baseUrl: string = "https://api.openai.com/v1/chat/completions", model: string = "gpt-4o-mini", systemPrompt: string = "You are a helpful assistant.", maxTokens: number = 1000) {
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
					{ role: "system", content: systemPrompt },
					{ role: "user", content: `${prompt}\n\nContent:\n${content.substring(0, 15000)}` }
				],
				max_tokens: maxTokens
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

// Cleanup / Manual Trigger Endpoint
app.get("/api/v1/cleanup", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	await cleanupRoutine(c.env);

	return c.json({ success: true, message: "Cleanup routine executed." });
});



// Admin: Get All Emails (paginated)
app.get("/api/v1/admin/emails", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	const limit = parseInt(c.req.query("limit") || "50");
	const offset = parseInt(c.req.query("offset") || "0");
	const db = getCloudflareD1(c.env.DB);

	// @ts-ignore
	const emails = await getAllEmails(db, limit, offset, c.req.query("search"));
	return c.json(emails);
});

// Admin: Get Stats
app.get("/api/v1/admin/stats", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	const db = getCloudflareD1(c.env.DB);
	const [senders, receivers] = await Promise.all([
		getSenderStats(db),
		getReceiverStats(db)
	]);

	return c.json({ senders, receivers });
});

// Admin: Export All Emails
app.get("/api/v1/admin/export", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	const db = getCloudflareD1(c.env.DB);
	const data = await getAllEmailsForExport(db);

	// Return as downloadable file
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			"Content-Type": "application/json",
			"Content-Disposition": `attachment; filename="vmail-export-${new Date().toISOString().split('T')[0]}.json"`
		}
	});
});

// Admin: Blocklist Endpoints
app.get("/api/v1/admin/blocklist", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	const db = getCloudflareD1(c.env.DB);
	const list = await getBlockedSenders(db);
	return c.json(list);
});

app.post("/api/v1/admin/blocklist", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	try {
		const { email } = await c.req.json<{ email: string }>();
		if (!email || !email.includes('@')) return c.json({ error: "Invalid email/domain" }, 400);

		const db = getCloudflareD1(c.env.DB);
		// @ts-ignore
		await addBlockedSender(db, email, "Blocked via Admin Panel");
		return c.json({ success: true });
	} catch (e: any) {
		return c.json({ error: e.message, stack: e.stack }, 500);
	}
});

// DEBUG ENDPOINT
app.get("/api/v1/admin/debug/block", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	try {
		const db = getCloudflareD1(c.env.DB);
		const testEmail = `debug-${Date.now()}@test.com`;
		// @ts-ignore
		const res = await addBlockedSender(db, testEmail, "Debug Insert");
		// @ts-ignore
		const list = await getBlockedSenders(db);
		return c.json({ success: true, inserted: testEmail, list: list, rawRes: res });
	} catch (e: any) {
		return c.json({ error: e.message, stack: e.stack, type: "DB_INSERT_FAIL" }, 500);
	}
});

app.delete("/api/v1/admin/blocklist", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	const email = c.req.query("email");
	if (!email) return c.json({ error: "Missing email param" }, 400);

	const db = getCloudflareD1(c.env.DB);
	await removeBlockedSender(db, email);
	return c.json({ success: true });
});

// Admin: Bulk Delete Emails
app.post("/api/v1/admin/emails/delete", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	try {
		const { ids } = await c.req.json<{ ids: string[] }>();
		if (!ids || !Array.isArray(ids) || ids.length === 0) {
			return c.json({ error: "Invalid IDs" }, 400);
		}

		const db = getCloudflareD1(c.env.DB);

		// 1. Get Attachments for all emails to delete from R2
		// @ts-ignore
		const attachments = await getAttachmentsByEmailIds(db, ids);
		if (attachments && attachments.length > 0) {
			const keysToDelete = attachments.map((a: any) => a.r2Key);

			// Batch delete from R2 (limit is usually 1000, we are safe with UI paging)
			if (keysToDelete.length > 0) {
				await c.env.R2.delete(keysToDelete);
			}
			// @ts-ignore
			await deleteAttachmentsByEmailIds(db, ids);
		}

		// 2. Delete Emails
		await deleteEmails(db, ids);

		return c.json({ success: true, count: ids.length });
	} catch (e: any) {
		return c.json({ error: e.message }, 500);
	}
});

// Admin: Delete Email (Single)
app.delete("/api/v1/admin/email/:id", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	const id = c.req.param("id");
	const db = getCloudflareD1(c.env.DB);

	// Delete from R2 first
	// @ts-ignore
	const attachments = await getAttachmentsByEmailId(db, id);
	if (attachments && attachments.length > 0) {
		const keysToDelete = attachments.map((a: any) => a.r2Key);
		if (keysToDelete.length > 0) {
			await c.env.R2.delete(keysToDelete);
		}
		// @ts-ignore
		await deleteAttachmentsByEmailId(db, id);
	}

	// Delete from DB
	// @ts-ignore
	await deleteEmail(db, id);

	return c.json({ success: true, id });
});

// Email Sending Helper (now an API endpoint)
app.post("/api/v1/send", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	try {
		const { to, subject, content, from } = await c.req.json<any>();
		if (!to || !subject || !content) return c.json({ error: "Missing fields" }, 400);

		// Determine Sender
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

// Serve Attachments
app.get("/api/v1/attachments/:emailId/:filename", async (c) => {
	const emailId = c.req.param("emailId");
	const filename = c.req.param("filename");
	const key = `emails/${emailId}/${filename}`;

	try {
		// Use R2 binding to get the object
		const object = await c.env.R2.get(key);
		if (!object) return c.text("Attachment not found", 404);

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set("etag", object.httpEtag);
		if (!headers.get("Content-Type")) {
			headers.set("Content-Type", "application/octet-stream");
		}

		return new Response(object.body, {
			headers,
		});
	} catch (e) {
		console.error("R2 Error:", e);
		return c.text("Internal Error", 500);
	}
});


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
					const from = email.messageFrom;
					const to = email.messageTo;
					const subject = email.subject || "(No Subject)";
					const workerUrl = c.env.WORKER_URL || "https://emails-worker.trung27031.workers.dev";
					const viewUrl = `${workerUrl}/view/${email.id}`;

					const headerMsg = `📬 *New Email*\n` +
						`Subject: ${subject}\n` +
						`From: ${from}\n` +
						`To: ${to}\n` +
						`Received: ${new Date(email.createdAt).toLocaleString()}\n`;

					const keyboard = {
						inline_keyboard: [
							[
								{ text: "👁️ Preview", callback_data: `preview:${email.id}` },
								{ text: "🌍 Read Online", url: viewUrl }
							],
							[
								{ text: "📝 Summary", callback_data: `summary:${email.id}` },
								{ text: "📄 Text", callback_data: `text:${email.id}` }
							],
							[
								{ text: "🚫 Block Sender", callback_data: `blk:${email.id}` },
								{ text: "✅ Whitelist Sender", callback_data: `wht:${email.id}` }
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
					// @ts-ignore
					let summary = email.summary;
					if (!summary && c.env.OPENAI_API_KEY) {
						await answerCallbackQuery(token, query.id, "Generating summary...");
						const lang = c.env.SUMMARY_TARGET_LANG || "English";
						summary = await callOpenAI(
							c.env.OPENAI_API_KEY,
							`Summarize the key points of this email in 1-2 sentences in ${lang}. Be concise but capture the main essence.`,
							email.text || email.html || "",
							c.env.OPENAI_COMPLETIONS_API,
							c.env.OPENAI_CHAT_MODEL,
							"You are a helpful assistant. Output concise summary.",
							2000
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
				// Fallback or Legacy: If triggered, show link
				const email = await getEmail(db, target);
				if (email) {
					const workerUrl = c.env.WORKER_URL || "https://emails-worker.trung27031.workers.dev";
					const viewUrl = `${workerUrl}/view/${target}`;
					await editTelegramMessage(token, chatId, messageId, `🌍 *Read Online:*\n\n${viewUrl}`, false, getBackKeyboard(target));
				}
			}
			else if (action === "del") {
				await deleteEmail(db, target);
				await editTelegramMessage(token, chatId, messageId, "🗑️ Email deleted.");
			}
			else if (action === "blk") {
				// Support both ID and Direct Email (Hybrid)
				let targetEmail = target;
				if (!target.includes("@")) {
					const email = await getEmail(db, target);
					if (email) targetEmail = email.messageFrom;
					else targetEmail = "";
				}

				if (targetEmail) {
					await blockSenderCaller(db, targetEmail);
					await answerCallbackQuery(token, query.id, `🚫 Blocked: ${targetEmail}`);
				} else {
					await answerCallbackQuery(token, query.id, "❌ Email not found");
				}
			}
			else if (action === "wht") {
				// Support both ID and Direct Email (Hybrid)
				let targetEmail = target;
				if (!target.includes("@")) {
					const email = await getEmail(db, target);
					if (email) targetEmail = email.messageFrom;
					else targetEmail = "";
				}

				if (targetEmail) {
					await whitelistSenderCaller(db, targetEmail);
					await answerCallbackQuery(token, query.id, `✅ Whitelisted: ${targetEmail}`);
				} else {
					await answerCallbackQuery(token, query.id, "❌ Email not found");
				}
			}
			else if (action.startsWith("unblock_list")) {
				// Manage unblocking from list (Target is email here, as list is local)
				await whitelistSenderCaller(db, target);
				await editTelegramMessage(token, chatId, messageId, `✅ Unblocked ${target}. List updated.`);
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
					// Button data limit is 64 bytes. "wht:" is 4 bytes. Email must be < 60 bytes.
					if (item.email.length < 58) {
						keyboardRows.push([{ text: `🔓 Unblock ${item.email}`, callback_data: `wht:${item.email}` }]);
					}
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
	const result = await callOpenAI(openAIKey, "Summarize this email in 1-2 sentences.", content, c.env.OPENAI_COMPLETIONS_API, c.env.OPENAI_CHAT_MODEL, "You are a helpful assistant.", 2000);
	return c.json({ summary: result });
});

// AI Generate Reply Endpoint
app.post("/api/v1/admin/ai/reply", async (c: Context<{ Bindings: Bindings }>) => {
	const key = c.req.header("X-API-Key");
	if (key !== c.env.API_KEY) return c.json({ error: "Unauthorized" }, 401);

	try {
		const { emailId, instructions } = await c.req.json<{ emailId: string, instructions?: string }>();
		if (!emailId) return c.json({ error: "Missing emailId" }, 400);

		const openAIKey = c.env.OPENAI_API_KEY;
		if (!openAIKey) return c.json({ error: "AI not configured" }, 500);

		const db = getCloudflareD1(c.env.DB);
		const email = await getEmail(db, emailId);
		if (!email) return c.json({ error: "Email not found" }, 404);

		const content = email.text || email.html || "No content";
		const customInstructions = instructions || "Reply professionally and concisely.";


		const prompt = `Draft a reply to the email below.
Instructions: ${customInstructions}
Original Sender: ${email.messageFrom}
Content:`;

		const reply = await callOpenAI(
			openAIKey,
			prompt,
			content,
			c.env.OPENAI_COMPLETIONS_API,
			c.env.OPENAI_CHAT_MODEL,
			"You are a professional email assistant. Draft a complete, polite, and context-aware reply based on the user's instructions. Do not cut off the response. Provide a full email body.",
			2500 // Increase max tokens to prevent truncation
		);

		return c.json({ reply });
	} catch (e: any) {
		return c.json({ error: e.message }, 500);
	}
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
		if (parts.length === 2 && parts[1]) domains.add(parts[1].trim());
	}

	// 3. Add from MAIL_SENDER_n
	for (let i = 1; i <= 5; i++) {
		const senderList = (c.env[`MAIL_SENDER_${i}`] as string) || "";
		if (senderList) {
			senderList.split(",").forEach(d => {
				const trimmed = d.trim();
				if (trimmed.includes("@")) {
					const domain = trimmed.split("@")[1];
					if (domain) domains.add(domain);
				} else {
					domains.add(trimmed);
				}
			});
		}
	}

	return c.json({ domains: Array.from(domains).sort() });
});

// Serve Email HTML (View Online)
app.get("/view/:emailId", async (c) => {
	const emailId = c.req.param("emailId");
	const db = getCloudflareD1(c.env.DB);
	const email = await getEmail(db, emailId);

	if (!email) return c.text("Email not found", 404);

	let html = email.html || `<html><body><pre>${email.text || "No content"}</pre></body></html>`;

	// Inject basic styles for better reading
	if (!html.includes("<html")) {
		html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;
	}

	return c.html(html);
});

// Automation API Endpoints
app.get("/api/v1/inbox/:address", async (c) => {
	// ... existing logic
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


// Webhook Helper
async function sendWebhook(env: Bindings, email: any) {
	if (!env.WEBHOOK_URL) return;
	try {
		const payload = {
			id: email.id,
			from: email.messageFrom,
			to: email.messageTo,
			subject: email.subject,
			text: email.text,
			html: (email.html && email.html.length < 50000) ? email.html : undefined, // Limit HTML size for Webhook
			// summary: email.summary, // Summary column not yet in DB
			receivedAt: email.createdAt,
			attachments: email.attachments?.map((a: any) => ({
				filename: a.filename,
				url: `${env.WORKER_URL || "https://emails-worker.trung27031.workers.dev"}/api/v1/attachments/${email.id}/${encodeURIComponent(a.filename)}`
			}))
		};

		const res = await fetch(env.WEBHOOK_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});
		if (!res.ok) {
			console.error(`Webhook failed: ${res.status} ${await res.text()}`);
		}
	} catch (e) {
		console.error("Webhook Error:", e);
	}
}

// ...

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		const bindings = env as Bindings;
		try {
			// 2. Parse Email
			const rawText = await new Response(message.raw).text();
			const mail = await new PostalMime().parse(rawText);
			const now = new Date();
			const emailId = nanoid();

			// Determine Sender for Display & DB (Prefer Header From for clean aggregation)
			let displaySender = message.from; // Default to Envelope From
			if (message.headers && message.headers.get("From")) {
				const headerFrom = message.headers.get("From");
				// Extract email from "Name <email@domain.com>"
				const match = headerFrom?.match(/<(.+)>/);
				if (match && match[1]) {
					displaySender = match[1].toLowerCase();
				} else if (headerFrom && headerFrom.includes("@")) {
					displaySender = headerFrom.toLowerCase();
				}
			}

			// 1. Blocklist Check (Check BOTH Envelope and Header From to be safe)
			const db = getCloudflareD1(bindings.DB);
			if (await isSenderBlocked(db, message.from) || await isSenderBlocked(db, displaySender)) {
				console.log(`Blocked email from: ${message.from} / ${displaySender}`);
				message.setReject("Sender is blocked");
				return;
			}

			// 3. Process Attachments
			const workerUrl = bindings.WORKER_URL || "https://emails-worker.trung27031.workers.dev";
			const attachmentMeta: any[] = []; // For webhook

			if (mail.attachments && mail.attachments.length > 0) {
				for (const att of mail.attachments) {
					const filename = att.filename || `file-${nanoid(4)}`;
					const key = `emails/${emailId}/${filename}`;
					const cid = att.contentId ? att.contentId.replace(/[<>]/g, "") : null;

					// Fix: content might be string or ArrayBuffer
					const contentValues = att.content;
					let size = 0;
					if (typeof contentValues === 'string') {
						size = contentValues.length;
					} else if (contentValues && typeof (contentValues as any).byteLength === 'number') {
						size = (contentValues as any).byteLength;
					}

					// Upload to R2
					await bindings.R2.put(key, contentValues, {
						httpMetadata: { contentType: att.mimeType }
					});

					// Save Metadata
					const attData: InsertAttachment = {
						id: nanoid(),
						emailId: emailId,
						filename: filename,
						contentType: att.mimeType,
						size: size,
						r2Key: key,
						cid: cid,
						createdAt: now
					};
					await insertAttachment(db, attData);
					attachmentMeta.push(attData);

					// Rewrite HTML
					if (cid && mail.html) {
						const publicUrl = `${workerUrl}/api/v1/attachments/${emailId}/${encodeURIComponent(filename)}`;
						const regex = new RegExp(`cid:${cid}`, "g");
						mail.html = mail.html.replace(regex, publicUrl);
					}
				}
			}

			// 4. Backup Forwarding
			if (bindings.BACKUP_EMAIL) {
				try {
					await message.forward(bindings.BACKUP_EMAIL);
				} catch (fwErr) {
					console.error("Backup forward failed:", fwErr);
				}
			}

			// 5. Save to Database
			const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
			let cleanText = mail.text;
			if (!cleanText && mail.html) cleanText = stripHtml(mail.html);
			else if (cleanText && (cleanText.trim().startsWith("<") || cleanText.includes("</html>"))) cleanText = stripHtml(cleanText);

			const newEmail: InsertEmail = {
				id: emailId,
				// ... (Mapping same as before)
				messageFrom: displaySender,
				messageTo: message.to,
				...mail,
				text: cleanText || null,
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

			// 6. Trigger Webhook
			await sendWebhook(bindings, { ...newEmail, attachments: attachmentMeta });


			// function moved out

			// 7. Telegram Notification
			// ... (Same as before)
			const tgToken = bindings.TELEGRAM_BOT_TOKEN;
			const tgId = bindings.TELEGRAM_ID;

			if (tgToken && tgId) {
				const escapeHtml = (str: string) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

				const subject = escapeHtml(mail.subject || "(No Subject)");
				const from = escapeHtml(displaySender);
				const to = escapeHtml(typeof mail.to === 'string' ? mail.to : (mail.to?.[0]?.address || "Unknown"));

				// Check for OTP
				const otp = extractOtp(mail.subject || "", mail.text || "");
				const otpLine = otp ? `\n🔑 OTP: <code>${otp}</code>` : "";

				// HTML Message
				let alertMsg = `📬 <b>New Email</b>\n` +
					`<b>Subject:</b> ${subject}\n` +
					`<b>From:</b> ${from}\n` +
					`<b>To:</b> ${to}\n` +
					`<b>Received:</b> ${now.toLocaleString()}\n` +
					`${otpLine}`;

				// Attachments List
				if (attachmentMeta.length > 0) {
					alertMsg += `\n\n📎 <b>Attachments:</b>\n`;
					attachmentMeta.forEach((att, index) => {
						const safeFilename = escapeHtml(att.filename);
						// Public Download Link
						const downloadUrl = `${bindings.WORKER_URL || "https://emails-worker.trung27031.workers.dev"}/api/v1/attachments/${newEmail.id}/${encodeURIComponent(att.filename)}`;
						alertMsg += `${index + 1}. <a href="${downloadUrl}">${safeFilename}</a> (${(att.size / 1024).toFixed(1)} KB)\n`;
					});
				}

				const viewUrl = `${bindings.WORKER_URL || "https://emails-worker.trung27031.workers.dev"}/view/${newEmail.id}`;

				const keyboard = {
					inline_keyboard: [
						[
							{ text: "👁️ Preview", callback_data: `preview:${newEmail.id}` },
							{ text: "🌍 Read Online", url: viewUrl }
						],
						[
							{ text: "📝 Summary", callback_data: `summary:${newEmail.id}` },
							{ text: "📄 Text", callback_data: `text:${newEmail.id}` }
						],
						[
							{ text: "🚫 Block Sender", callback_data: `blk:${newEmail.id}` },
							{ text: "✅ Whitelist Sender", callback_data: `wht:${newEmail.id}` }
						]
					]
				};

				// Broadcast to all master IDs
				const ids = tgId.split(",");
				for (const id of ids) {
					// Use HTML mode (true)
					await sendTelegramMessage(tgToken, parseInt(id.trim()), alertMsg, true, keyboard);
				}
			}

		} catch (e) {
			console.error("Email Worker Error:", e);
		}
	},
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return app.fetch(request, env, ctx);
	},
	// @ts-ignore
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(cleanupRoutine(env as Bindings));
	}
} satisfies ExportedHandler<Env>;

async function cleanupRoutine(env: Bindings) {
	try {
		console.log("Only keeping the latest emails...");
		const db = getCloudflareD1(env.DB);

		// Default to 1000 if not set
		const maxEmails = parseInt(env.MAX_EMAILS || "1000");

		// 1. Get IDs to delete
		const idsToDelete = await getEmailsToDelete(db, maxEmails);
		console.log(`Found ${idsToDelete.length} emails to delete (Limit: ${maxEmails})`);

		if (idsToDelete.length === 0) return;

		// 2. Process Deletion
		for (const id of idsToDelete) {
			// 2.1 Get Attachments from R2
			const attachments = await getAttachmentsByEmailId(db, id);
			if (attachments && attachments.length > 0) {
				const keysToDelete = attachments.map((a: any) => a.r2Key);
				if (keysToDelete.length > 0) {
					await env.R2.delete(keysToDelete);
					console.log(`Deleted ${keysToDelete.length} files from R2 for email ${id}`);
				}
				// Delete from attachments table
				await deleteAttachmentsByEmailId(db, id);
			}

			// 2.2 Delete Email from DB
			await deleteEmail(db, id);
			console.log(`Deleted email ${id} from DB`);
		}
	} catch (e) {
		console.error("Cleanup Error:", e);
	}
}


