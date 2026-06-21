import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where 
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { Conversation } from "../types";

// Initialize Firebase App singularly to avoid multi-init errors
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

export const provider = new GoogleAuthProvider();

// Add all requested scopes to user oauth flow
const scopes = [
  "https://www.googleapis.com/auth/chat.spaces",
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages",
  "https://www.googleapis.com/auth/chat.messages.create",
  "https://www.googleapis.com/auth/chat.memberships",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose"
];

scopes.forEach(scope => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;

/**
 * Sync status authentication check callback loader
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // If we have user but no memorized token, can request token sign-in popup or alert
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Handle user Google authentication flow with workspace capabilities consent
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Google Access Token matching required credentials.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Firebase Sign in with Google error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Reset authentication state
 */
export const logoutUser = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const getCachedToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedToken = (token: string | null) => {
  cachedAccessToken = token;
};

// ==========================================
// FIRESTORE SYNC LOGIC
// ==========================================

/**
 * Sync active conversation log securely with cloud Firestore
 */
export const saveConversationToFirestore = async (conv: Conversation, userId: string) => {
  try {
    const convoRef = doc(db, "conversations", conv.id);
    await setDoc(convoRef, {
      ...conv,
      userId,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Firestore persistence warning:", err);
  }
};

/**
 * Retrieve user historic research records from cloud Firestore database
 */
export const fetchConversationsFromFirestore = async (userId: string): Promise<Conversation[]> => {
  try {
    const q = query(collection(db, "conversations"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const results: Conversation[] = [];
    snap.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      results.push({
        id: data.id,
        title: data.title,
        systemInstruction: data.systemInstruction,
        model: data.model,
        temperature: data.temperature,
        createdAt: data.createdAt,
        messages: data.messages || []
      });
    });
    // Sort manually by createdAt descending
    return results.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error("Error retrieving records from Firestore database:", err);
    return [];
  }
};

/**
 * Remove record item from Cloud Firestore
 */
export const deleteConversationFromFirestore = async (convoId: string) => {
  try {
    await deleteDoc(doc(db, "conversations", convoId));
  } catch (err) {
    console.error("Error deleting conversation from Firestore:", err);
  }
};


// ==========================================
// GOOGLE SHEETS API
// ==========================================

export const createLogSpreadsheet = async (accessToken: string, title: string): Promise<string> => {
  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: { title: "Safety Run Logs" },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "Timestamp" } },
                    { userEnteredValue: { stringValue: "Conversation Title" } },
                    { userEnteredValue: { stringValue: "Target Model" } },
                    { userEnteredValue: { stringValue: "Temperature" } },
                    { userEnteredValue: { stringValue: "Prompt Evaluated" } },
                    { userEnteredValue: { stringValue: "AI Dispatch Answer" } },
                    { userEnteredValue: { stringValue: "Directives Profile" } }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create Google Sheet: ${errText}`);
  }

  const data = await response.json();
  return data.spreadsheetId;
};

export const logRunToSpreadsheet = async (
  accessToken: string,
  spreadsheetId: string,
  rowData: string[]
): Promise<boolean> => {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Safety%20Run%20Logs!A:G:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [rowData]
      })
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Google Sheets Appending failed:", errText);
    return false;
  }
  return true;
};


// ==========================================
// GOOGLE DRIVE API
// ==========================================

export const listDriveSpreadsheets = async (
  accessToken: string
): Promise<{ id: string; name: string }[]> => {
  const q = encodeURIComponent("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=30&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    console.error("Failed to list active spreadsheets in Drive");
    return [];
  }
  const data = await response.json();
  return data.files || [];
};

/**
 * Upload compiled report PDF directly to a newly created folder or files bucket
 */
export const uploadPdfToDrive = async (
  accessToken: string,
  pdfBlob: Blob,
  filename: string
): Promise<string> => {
  const metadata = {
    name: filename,
    mimeType: "application/pdf"
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", pdfBlob);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: form
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to save report to Google Drive: ${errText}`);
  }

  const data = await response.json();
  return data.id;
};


// ==========================================
// GMAIL DISPATCH SERVICE
// ==========================================

function buildMimeMessage(
  to: string,
  subject: string,
  body: string,
  attachmentFileName?: string,
  attachmentBase64?: string
): string {
  const boundary = "boundary_elector_" + Math.random().toString(36).substring(2);
  let mime = "";
  mime += `To: ${to}\r\n`;
  mime += `Subject: ${subject}\r\n`;
  mime += `MIME-Version: 1.0\r\n`;
  mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

  mime += `--${boundary}\r\n`;
  mime += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
  mime += `<div style="font-family: sans-serif; color: #1e293b;">
    <h2 style="color: #0d9488;">ELECTOR Safety Research Alert</h2>
    <p>${body.replace(/\n/g, "<br>")}</p>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
    <span style="font-size: 11px; color: #64748b;">CIVIC SAFETY WORKSPACE • REPORT GENERATED VIA EMAIL CO-PILOT APLET</span>
  </div>\r\n\r\n`;

  if (attachmentFileName && attachmentBase64) {
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: application/pdf; name="${attachmentFileName}"\r\n`;
    mime += `Content-Transfer-Encoding: base64\r\n`;
    mime += `Content-Disposition: attachment; filename="${attachmentFileName}"\r\n\r\n`;
    mime += `${attachmentBase64}\r\n\r\n`;
  }

  mime += `--${boundary}--`;

  // Standard safe base64url encoder
  const utf8Bytes = new TextEncoder().encode(mime);
  let binString = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binString += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binString)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const sendReportEmail = async (
  accessToken: string,
  to: string,
  subject: string,
  bodyText: string,
  attachmentFileName?: string,
  attachmentBase64?: string
): Promise<boolean> => {
  const rawMime = buildMimeMessage(to, subject, bodyText, attachmentFileName, attachmentBase64);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw: rawMime })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gmail Dispatch Error reply:", errText);
    return false;
  }
  return true;
};


// ==========================================
// GOOGLE CHAT API
// ==========================================

export const listChatSpaces = async (
  accessToken: string
): Promise<{ name: string; displayName: string }[]> => {
  const response = await fetch("https://chat.googleapis.com/v1/spaces?pageSize=50", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    console.error("Error from Google Chat Endpoint: spaces could not be queried.");
    return [];
  }

  const data = await response.json();
  return data.spaces || [];
};

export const postChatMessage = async (
  accessToken: string,
  spaceName: string, // format is usually spaces/XXXXXXXX
  text: string
): Promise<boolean> => {
  const response = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Google Chat publish message fail:", errText);
    return false;
  }
  return true;
};
