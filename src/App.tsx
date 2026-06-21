import { useState, useEffect, useRef } from "react";
import { Conversation, Message, Preset } from "./types";
import { PRESETS, SYSTEM_INSTRUCTION_DEFAULT, INITIAL_RESPONSES } from "./data/presets";
import { INITIAL_POLITICAL_RECORDS, INDIAN_STATES_UTS, PoliticalRecord } from "./data/politicalData";
import { MessageItem } from "./components/MessageItem";
import { PolitiChatIcon, PolitiChatWovenStar, PolitiChatLogoHeader } from "./components/BrandLogo";
import { exportConversationToPDF, generateConversationPDF } from "./utils/pdfExport";
import {
  initAuth,
  googleSignIn,
  logoutUser,
  saveConversationToFirestore,
  fetchConversationsFromFirestore,
  deleteConversationFromFirestore,
  createLogSpreadsheet,
  logRunToSpreadsheet,
  listDriveSpreadsheets,
  uploadPdfToDrive,
  sendReportEmail,
  listChatSpaces,
  postChatMessage
} from "./utils/workspaceServices";
import { User } from "firebase/auth";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Settings,
  Sparkles,
  Zap,
  Shield,
  HelpCircle,
  Menu,
  X,
  FileText,
  Database,
  Terminal,
  Lock,
  ChevronRight,
  RefreshCw,
  Sliders,
  Compass,
  CheckCircle,
  AlertOctagon,
  Download,
  Mail,
  Upload,
  Globe,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  LogOut,
  Cloud,
  Search,
  Filter
} from "lucide-react";

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [inputText, setInputText] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  // Interactive Monitor Tabs & Data management states
  const [activeTab, setActiveTab] = useState<'chat' | 'monitor'>('chat');
  const [politicalRecords, setPoliticalRecords] = useState<PoliticalRecord[]>(() => {
    const saved = localStorage.getItem("politi_chat_records");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved political records:", e);
      }
    }
    return INITIAL_POLITICAL_RECORDS;
  });

  // Keep political records in sync with localStorage
  useEffect(() => {
    localStorage.setItem("politi_chat_records", JSON.stringify(politicalRecords));
  }, [politicalRecords]);

  // Monitor Navigation/Filter states
  const [monitorSearch, setMonitorSearch] = useState<string>("");
  const [monitorStateFilter, setMonitorStateFilter] = useState<string>("All");
  const [monitorTypeFilter, setMonitorTypeFilter] = useState<string>("All");
  const [monitorPage, setMonitorPage] = useState<number>(1);

  // Report New Dispute Form modal states
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [formState, setFormState] = useState<string>("Andhra Pradesh");
  const [formType, setFormType] = useState<"Election Process" | "Assembly Politics" | "Governance/Clash" | "Dissent & Coalition" | "Security/Unrest" | "Policy Protest" | "Administrative Audit">("Election Process");
  const [formIssue, setFormIssue] = useState<string>("");
  const [formRecentItem, setFormRecentItem] = useState<string>("");
  const [formDate, setFormDate] = useState<string>("");
  const [formSource, setFormSource] = useState<string>("");
  
  // Settings control
  const [systemInstructionInput, setSystemInstructionInput] = useState<string>(SYSTEM_INSTRUCTION_DEFAULT);
  const [modelSelect, setModelSelect] = useState<string>("gemini-3.5-flash");
  const [temperatureVal, setTemperatureVal] = useState<number>(0.4);
  const [enableGoogleSearch, setEnableGoogleSearch] = useState<boolean>(false);
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Google Workspace & Firebase Integration States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState<boolean>(false);

  // Sheets Settings
  const [targetSpreadsheetId, setTargetSpreadsheetId] = useState<string>("");
  const [availableSheets, setAvailableSheets] = useState<{ id: string; name: string }[]>([]);
  const [isCreatingSheet, setIsCreatingSheet] = useState<boolean>(false);
  const [isLoggingSheet, setIsLoggingSheet] = useState<boolean>(false);
  const [lastSheetLogStatus, setLastSheetLogStatus] = useState<string>("");

  // Drive Settings
  const [isSavingToDrive, setIsSavingToDrive] = useState<boolean>(false);
  const [driveUploadStatus, setDriveUploadStatus] = useState<string>("");

  // Gmail Settings
  const [emailTo, setEmailTo] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("ELECTOR Safety Research Alert Dispatch");
  const [emailBody, setEmailBody] = useState<string>("Security review audit for the active conversation history. File contains alignment evaluations.");
  const [isEmailSending, setIsEmailSending] = useState<boolean>(false);
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [emailAttachPdf, setEmailAttachPdf] = useState<boolean>(true);

  // Chat Settings
  const [availableChatSpaces, setAvailableChatSpaces] = useState<{ name: string; displayName: string }[]>([]);
  const [targetChatSpace, setTargetChatSpace] = useState<string>("");
  const [chatMessageText, setChatMessageText] = useState<string>("");
  const [isChatSending, setIsChatSending] = useState<boolean>(false);
  const [chatStatus, setChatStatus] = useState<string>("");

  // Load from local storage on startup
  useEffect(() => {
    try {
      const saved = localStorage.getItem("elector_feed_conversations");
      if (saved) {
        const parsed = JSON.parse(saved) as Conversation[];
        if (parsed.length > 0) {
          setConversations(parsed);
          setActiveConvId(parsed[0].id);
          // Set inputs to match first active conv
          setSystemInstructionInput(parsed[0].systemInstruction || SYSTEM_INSTRUCTION_DEFAULT);
          setModelSelect(parsed[0].model || "gemini-3.5-flash");
          setTemperatureVal(parsed[0].temperature || 0.4);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load history from LocalStorage", e);
    }

    // Default: load first positioning preset as default
    handleSelectPreset(PRESETS[0]);
  }, []);

  // Hook up firebase auth listener securely on start
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setGoogleToken(token);
        if (user.email) {
          setEmailTo(user.email);
        }
      },
      () => {
        setCurrentUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setGoogleToken(res.accessToken);
        if (res.user.email) {
          setEmailTo(res.user.email);
        }
      }
    } catch (err) {
      console.error("Sign in failed:", err);
    }
  };

  const handleGoogleLogout = async () => {
    const confirmation = window.confirm("Are you sure you want to disconnect your Google and Firebase account and clear current session cookies?");
    if (!confirmation) return;
    await logoutUser();
    setCurrentUser(null);
    setGoogleToken(null);
  };

  // Fetch from Firestore on user login
  useEffect(() => {
    if (currentUser) {
      fetchConversationsFromFirestore(currentUser.uid).then((fsConvs) => {
        if (fsConvs.length > 0) {
          setConversations(fsConvs);
          setActiveConvId(fsConvs[0].id);
        } else {
          // Sync existing to firestore
          conversations.forEach((c) => {
            saveConversationToFirestore(c, currentUser.uid);
          });
        }
      });
    } else {
      // Reload local storage
      try {
        const saved = localStorage.getItem("elector_feed_conversations");
        if (saved) {
          const parsed = JSON.parse(saved) as Conversation[];
          if (parsed.length > 0) {
            setConversations(parsed);
            setActiveConvId(parsed[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  }, [currentUser]);

  // Persist conversation updates
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("elector_feed_conversations", JSON.stringify(conversations));
      if (currentUser && activeConv) {
        saveConversationToFirestore(activeConv, currentUser.uid);
      }
    }
  }, [conversations, currentUser, activeConvId]);

  // Google Workspace items listing trigger
  useEffect(() => {
    if (googleToken) {
      listDriveSpreadsheets(googleToken).then((files) => {
        setAvailableSheets(files);
        if (files.length > 0 && !targetSpreadsheetId) {
          setTargetSpreadsheetId(files[0].id);
        }
      });

      listChatSpaces(googleToken).then((spaces) => {
        setAvailableChatSpaces(spaces);
        if (spaces.length > 0 && !targetChatSpace) {
          setTargetChatSpace(spaces[0].name);
        }
      });
    }
  }, [googleToken]);

  // Google Workspace & Firebase Actions Hooks
  const handleLogToSpreadsheet = async () => {
    if (!googleToken || !activeConv) return;
    setIsLoggingSheet(true);
    setLastSheetLogStatus("Logging current safety analysis run...");
    try {
      let sheetId = targetSpreadsheetId;
      if (!sheetId) {
        sheetId = await createLogSpreadsheet(googleToken, "ELECTOR Feed Safety Logs");
        setTargetSpreadsheetId(sheetId);
        const files = await listDriveSpreadsheets(googleToken);
        setAvailableSheets(files);
      }

      const prompt = activeConv.messages.find(m => m.role === "user")?.content || "No user input";
      const modelAnswer = activeConv.messages.find(m => m.role === "model")?.content || "No AI response";
      const rowData = [
        new Date().toLocaleString(),
        activeConv.title,
        activeConv.model,
        String(activeConv.temperature),
        prompt.substring(0, 500),
        modelAnswer.substring(0, 1000),
        activeConv.systemInstruction.substring(0, 500)
      ];

      const success = await logRunToSpreadsheet(googleToken, sheetId, rowData);
      if (success) {
        setLastSheetLogStatus("Logged safety assessment as a new row in Google Sheets!");
      } else {
        setLastSheetLogStatus("Failed to append logs row to the selected spreadsheet.");
      }
    } catch (err: any) {
      console.error(err);
      setLastSheetLogStatus(`Error: ${err.message || "Could not log to sheet"}`);
    } finally {
      setIsLoggingSheet(false);
    }
  };

  const handleUploadPdfToDrive = async () => {
    if (!googleToken || !activeConv) return;
    setIsSavingToDrive(true);
    setDriveUploadStatus("Compiling research document PDF...");
    try {
      const doc = generateConversationPDF(activeConv);
      const pdfBlob = doc.output("blob");
      const filename = `${activeConv.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_elector_analysis.pdf`;
      
      const fileId = await uploadPdfToDrive(googleToken, pdfBlob, filename);
      if (fileId) {
        setDriveUploadStatus(`Saved to Google Drive! Doc ID: ${fileId}`);
      } else {
        setDriveUploadStatus("Upload failed.");
      }
    } catch (err: any) {
      console.error(err);
      setDriveUploadStatus(`Drive Upload Error: ${err.message || "Failed"}`);
    } finally {
      setIsSavingToDrive(false);
    }
  };

  const handleSendGmailReport = async () => {
    if (!googleToken || !activeConv) return;
    setIsEmailSending(true);
    setEmailStatus("Sending report via Gmail API...");
    try {
      let attachmentName = undefined;
      let base64Pdf = undefined;

      if (emailAttachPdf) {
        const doc = generateConversationPDF(activeConv);
        const pdfDataUri = doc.output("datauristring");
        base64Pdf = pdfDataUri.split(",")[1];
        attachmentName = `${activeConv.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_elector_analysis.pdf`;
      }

      const success = await sendReportEmail(
        googleToken,
        emailTo,
        emailSubject,
        emailBody,
        attachmentName,
        base64Pdf
      );

      if (success) {
        setEmailStatus("Successfully sent research dispatch report!");
      } else {
        setEmailStatus("Failed to send message via Gmail.");
      }
    } catch (err: any) {
      console.error(err);
      setEmailStatus(`Gmail Dispatch Error: ${err.message || "Failed"}`);
    } finally {
      setIsEmailSending(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!googleToken || !targetChatSpace) return;
    setIsChatSending(true);
    setChatStatus("Posting safety alert transcript...");
    try {
      const activeText = chatMessageText || `[ELECTOR SAFETY MONITOR RUN] ALERT logged for Evaluation Category: "${activeConv?.title || "Custom Run"}". \nActive model configured: ${activeConv?.model}. \nCheck your platform console or the exported PDF reports for the full transcripts!`;
      
      const success = await postChatMessage(googleToken, targetChatSpace, activeText);
      if (success) {
        setChatStatus("Alert posted successfully to Google Chat space!");
        setChatMessageText("");
      } else {
        setChatStatus("Failed to post message to space.");
      }
    } catch (err: any) {
      console.error(err);
      setChatStatus(`Chat post error: ${err.message || "Failed"}`);
    } finally {
      setIsChatSending(false);
    }
  };

  // Keep configuration panel inputs in sync with the active conversation
  const activeConv = conversations.find((c) => c.id === activeConvId);
  useEffect(() => {
    if (activeConv) {
      setSystemInstructionInput(activeConv.systemInstruction);
      setModelSelect(activeConv.model);
      setTemperatureVal(activeConv.temperature);
    }
  }, [activeConvId]);

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages, isGenerating]);

  // Handler: Switch preset (immediate visual generation)
  const handleSelectPreset = (preset: Preset) => {
    const existing = conversations.find((c) => c.id === preset.id);
    if (existing) {
      setActiveConvId(preset.id);
      setIsSidebarOpen(window.innerWidth >= 1024);
      return;
    }

    // Create immediate pre-baked conversation
    const newConv: Conversation = {
      id: preset.id,
      title: preset.title,
      messages: [
        {
          id: `p-usr-${preset.id}`,
          role: "user",
          content: preset.prompt,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        {
          id: `p-model-${preset.id}`,
          role: "model",
          content: INITIAL_RESPONSES[preset.id] || "No prebaked response found.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ],
      systemInstruction: SYSTEM_INSTRUCTION_DEFAULT,
      model: "gemini-3.5-flash",
      temperature: 0.4,
      createdAt: new Date().toISOString(),
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(preset.id);
    setIsSidebarOpen(window.innerWidth >= 1024);
  };

  // Handler: Create blank chat
  const handleCreateNewChat = () => {
    const newId = crypto.randomUUID();
    const newConv: Conversation = {
      id: newId,
      title: `Custom Safety Review ${conversations.filter(c => !PRESETS.some(p => p.id === c.id)).length + 1}`,
      messages: [],
      systemInstruction: SYSTEM_INSTRUCTION_DEFAULT,
      model: "gemini-3.5-flash",
      temperature: 0.4,
      createdAt: new Date().toISOString(),
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newId);
    setInputText("");
    setIsSidebarOpen(window.innerWidth >= 1024);
  };

  // Handler: Delete conversation State
  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = conversations.filter((c) => c.id !== id);
    setConversations(filtered);
    if (activeConvId === id) {
      if (filtered.length > 0) {
        setActiveConvId(filtered[0].id);
      } else {
        // Fall back to loader if empty
        const freshId = crypto.randomUUID();
        const defaultConv: Conversation = {
          id: freshId,
          title: "Political Audit 1",
          messages: [],
          systemInstruction: SYSTEM_INSTRUCTION_DEFAULT,
          model: "gemini-3.5-flash",
          temperature: 0.4,
          createdAt: new Date().toISOString(),
        };
        setConversations([defaultConv]);
        setActiveConvId(freshId);
      }
    }
  };

  // Handler: Clear All Chat History
  const handleClearAllHistory = async () => {
    const confirmClear = window.confirm("Are you sure you want to completely clear your chat history? This will delete all local and synced cloud discussions.");
    if (!confirmClear) return;

    if (currentUser) {
      // Clear Firestore synced chats
      for (const c of conversations) {
        try {
          await deleteConversationFromFirestore(c.id);
        } catch (e) {
          console.error("Failed to delete from firestore on clear all:", e);
        }
      }
    }

    localStorage.removeItem("elector_feed_conversations");
    
    // Create a default initial clean political chat session
    const freshId = crypto.randomUUID();
    const defaultConv: Conversation = {
      id: freshId,
      title: "Political Audit 1",
      messages: [],
      systemInstruction: SYSTEM_INSTRUCTION_DEFAULT,
      model: "gemini-3.5-flash",
      temperature: 0.4,
      createdAt: new Date().toISOString(),
    };
    setConversations([defaultConv]);
    setActiveConvId(freshId);
    alert("Chat history completely cleared!");
  };

  // Handler: Audit a specific record from the State/UT Monitor inside Chat
  const handleAuditClick = (rec: PoliticalRecord) => {
    setActiveTab('chat');
    const auditPrompt = `Please perform an objective analysis, bias verification, and safety audit regarding this recent political development in ${rec.state}:
- **Issue**: ${rec.issue}
- **Category**: ${rec.type}
- **Recent Item**: ${rec.recentItem}
- **Approximate Date**: ${rec.date}
- **Asserted Source**: ${rec.source}

Check if this constitutes media bias, verify facts if possible, and state the political context.`;
    handleSend(auditPrompt);
  };

  // Handler: Delete record from local monitor list
  const handleDeleteRecord = (id: string) => {
    if (window.confirm("Are you sure you want to delete this political dispute record from your workspace state monitor?")) {
      setPoliticalRecords(prev => prev.filter(r => r.id !== id));
    }
  };

  // Handler: Add a brand new political or regional debate record manually
  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formIssue.trim() || !formRecentItem.trim() || !formSource.trim()) {
      alert("Please enter values for the Issue, Recent Item description, and Source/Citation fields.");
      return;
    }

    const newRec: PoliticalRecord = {
      id: `custom-${crypto.randomUUID()}`,
      state: formState,
      type: formType,
      issue: formIssue.trim(),
      recentItem: formRecentItem.trim(),
      date: formDate.trim() || new Date().toISOString().substring(0, 7),
      source: formSource.trim()
    };

    setPoliticalRecords(prev => [newRec, ...prev]);
    setIsReportModalOpen(false);

    // Reset input fields
    setFormIssue("");
    setFormRecentItem("");
    setFormDate("");
    setFormSource("");
    
    alert(`Successfully registered a new security dispute row under ${formState}!`);
  };

  // Handler: Submit text
  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || isGenerating || !activeConvId) return;

    if (!customText) {
      setInputText("");
    }

    // Proactive Client-Side Injection Screening
    const cleanQuery = textToSend.toLowerCase();
    const injectionChecklist = ["ignore previous guidelines", "system override", "jailbreak", "free persona", "pretend you are"];
    const foundInjection = injectionChecklist.some(pattern => cleanQuery.includes(pattern));

    // Append User Message
    const userMsgId = crypto.randomUUID();
    const userMsg: Message = {
      id: userMsgId,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Update active conversation in state immediately
    let targetConv = conversations.find(c => c.id === activeConvId);
    if (!targetConv) {
      const preset = PRESETS.find(p => p.id === activeConvId) || PRESETS[0];
      const freshId = activeConvId || preset.id;
      const defaultConv: Conversation = {
        id: freshId,
        title: preset.title,
        messages: [],
        systemInstruction: SYSTEM_INSTRUCTION_DEFAULT,
        model: "gemini-3.5-flash",
        temperature: 0.4,
        createdAt: new Date().toISOString(),
      };
      targetConv = defaultConv;
      setConversations(prev => [defaultConv, ...prev]);
    }
    const updatedMessages = [...targetConv.messages, userMsg];
    
    // Add pending empty model frame
    const modelMsgId = crypto.randomUUID();
    const pendingModelMsg: Message = {
      id: modelMsgId,
      role: "model",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setConversations(prev =>
      prev.map(c =>
        c.id === activeConvId
          ? { ...c, messages: [...updatedMessages, pendingModelMsg] }
          : c
      )
    );

    setIsGenerating(true);

    // If client safety block was triggered, bypass server and yield safe refusal immediately
    if (foundInjection) {
      await new Promise(r => setTimeout(r, 800)); // natural reading delay
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConvId
            ? {
                ...c,
                messages: c.messages.map(m =>
                  m.id === modelMsgId
                    ? {
                        ...m,
                        content: `### 🛡️ Safety Override Triggered\nYour prompt matches recognized key signatures for LLM context injection. \n\n**Action Refused**: Instruction manipulation is prohibited in this sandbox to aligned with Asia Track security specifications.`,
                        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      }
                    : m
                ),
              }
            : c
        )
      );
      setIsGenerating(false);
      return;
    }

    try {
      // 1. Fire Stream Query to Express secure controller
      const response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          systemInstruction: systemInstructionInput,
          model: modelSelect,
          temperature: temperatureVal,
          enableGoogleSearch,
        }),
      });

      if (!response.ok) {
        let errMsg = `Server API status: ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody && errBody.error) {
            errMsg = errBody.error;
          }
        } catch (_) {
          // Keep fallback if body lacks JSON error properties
        }
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let doneStream = false;
      let accumulatedText = "";
      const detectedSources: Map<string, { title: string; uri: string }> = new Map();

      while (!doneStream && reader) {
        const { value, done: isDone } = await reader.read();
        doneStream = isDone;
        if (value) {
          const chunkStr = decoder.decode(value);
          const lines = chunkStr.split("\n");
          
          for (const line of lines) {
            if (line.trim().startsWith("data: ")) {
              const textContent = line.trim().slice(6);
              if (textContent === "[DONE]") {
                doneStream = true;
                break;
              }
              try {
                const parsed = JSON.parse(textContent);
                
                // Track web sources if present
                if (parsed.groundingMetadata?.groundingChunks) {
                  for (const gChunk of parsed.groundingMetadata.groundingChunks) {
                    if (gChunk.web?.uri) {
                      const uri = gChunk.web.uri;
                      const title = gChunk.web.title || "Web Search Detail";
                      detectedSources.set(uri, { title, uri });
                    }
                  }
                }

                if (parsed.text) {
                  accumulatedText += parsed.text;
                }
                
                if (parsed.text || parsed.groundingMetadata) {
                  // Incremental updates
                  setConversations(prev =>
                    prev.map(c =>
                      c.id === activeConvId
                        ? {
                            ...c,
                            messages: c.messages.map(m =>
                              m.id === modelMsgId ? { 
                                ...m, 
                                content: accumulatedText,
                                groundingSources: detectedSources.size > 0 ? Array.from(detectedSources.values()) : undefined
                              } : m
                            ),
                          }
                        : c
                    )
                  );
                } else if (parsed.error) {
                  accumulatedText += `\n\n⚠️ **API Error:** ${parsed.error}`;
                  doneStream = true;
                }
              } catch (err) {
                // Ignore parsing errors for incomplete chunk fractions
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.error("Failed to fetch chat stream:", e);
      const isQuotaError = String(e?.message).includes("Gemini API Quota Exhausted") || String(e?.message).includes("quota");
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConvId
            ? {
                ...c,
                messages: c.messages.map(m =>
                  m.id === modelMsgId
                    ? {
                        ...m,
                        content: isQuotaError 
                          ? String(e.message)
                          : `### ⚠️ API Gateway Exhausted\nAn error occurred while establishing connection with server services.\n\n**Details**: ${e?.message || "Verify your internet or Secrets configurations in AI Studio tab."}`,
                      }
                    : m
                ),
              }
            : c
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Handler: Update active conversation configuration
  const handleSaveActiveConfig = () => {
    setConversations(prev =>
      prev.map(c =>
        c.id === activeConvId
          ? {
              ...c,
              systemInstruction: systemInstructionInput,
              model: modelSelect,
              temperature: temperatureVal,
            }
          : c
      )
    );
    setIsConfigDrawerOpen(false);
  };

  // Handler: reset settings input
  const handleResetConfigInputs = () => {
    setSystemInstructionInput(SYSTEM_INSTRUCTION_DEFAULT);
    setTemperatureVal(0.4);
    setModelSelect("gemini-3.5-flash");
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#050505] text-[#e5e5e5] font-sans antialiased relative">
      {/* Mesh Gradient background */}
      <div className="mesh-gradient"></div>
      
      {/* SIDEBAR LIST */}
      <aside
        id="sidebar-container"
        className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col glass-sidebar transition-transform duration-300 lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-0 -ml-80 lg:ml-0"
        }`}
      >
        {/* Header Title */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/5">
          <div className="flex items-center gap-2.5 hover:opacity-95 transition-opacity">
            <PolitiChatIcon className="w-8 h-8 hover:scale-105 transition-transform duration-250 text-blue-500" />
            <div>
              <h1 className="font-display font-semibold tracking-wider text-xs text-[#f8fafc] flex items-center gap-1.5 uppercase leading-none">
                PolitiChat GPT
              </h1>
              <p className="text-[9px] font-mono font-bold text-blue-400 tracking-wider uppercase leading-none mt-1">
                Security Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-slate-100 lg:hidden cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Actions / Separate Option Menus */}
        <div className="p-3 border-b border-white/5 space-y-2">
          <button
            id="btn-new-chat"
            onClick={handleCreateNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 px-4 font-display font-medium text-white shadow-lg shadow-blue-600/15 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Political Audit
          </button>

          <div className="pt-2 space-y-1">
            <button
              onClick={() => setIsGuidelinesOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs bg-white/[0.02] border border-white/5 hover:bg-white/5 text-slate-300 hover:text-slate-100 cursor-pointer transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>🎓 15 Safety Guidelines</span>
            </button>

            <button
              onClick={() => setIsConfigDrawerOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs bg-white/[0.02] border border-white/5 hover:bg-white/5 text-slate-300 hover:text-slate-100 cursor-pointer transition-all"
            >
              <Sliders className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>🔧 Config Playground</span>
            </button>

            <button
              onClick={() => setIsIntegrationsOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs bg-white/[0.02] border border-white/5 hover:bg-white/5 text-slate-300 hover:text-slate-100 cursor-pointer transition-all"
            >
              <Database className="w-3.5 h-3.5 text-amber-500" />
              <span>🔌 Workspace Sync</span>
            </button>

            <button
              onClick={handleClearAllHistory}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs bg-red-550/10 border border-red-500/15 hover:bg-red-505/20 text-red-400 cursor-pointer transition-all font-mono hover:bg-red-500/20"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>🧹 Clear Chat History</span>
            </button>
          </div>
        </div>

        {/* Scrollable Chat History & Active Sessions */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="px-3 mb-2 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10.5px] uppercase tracking-wider font-mono font-semibold text-slate-400">
              📜 Chat History / Active Sessions
            </span>
          </div>

          <div className="space-y-1">
            {(() => {
              const seenIds = new Set<string>();
              const uniqueConvs = conversations.filter((c) => {
                if (!c || !c.id || seenIds.has(c.id)) return false;
                seenIds.add(c.id);
                return true;
              });
              return uniqueConvs.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic text-center py-4">No active sessions</p>
              ) : (
                uniqueConvs.map((c) => {
                  const isActive = activeConvId === c.id;
                  const isPreset = PRESETS.some((p) => p.id === c.id);
                  return (
                    <div
                      key={c.id}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-all duration-150 ${
                        isActive
                          ? "bg-white/10 border border-white/10 text-white font-medium"
                          : "border border-transparent hover:bg-white/5 text-slate-300 hover:text-slate-100"
                      }`}
                    >
                      <button
                        onClick={() => setActiveConvId(c.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                      >
                        {isPreset ? (
                          <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                        ) : (
                          <Terminal className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                        )}
                        <span className="truncate pr-1">{c.title}</span>
                      </button>
                      <button
                        id={`btn-delete-conv-${c.id}`}
                        onClick={(e) => handleDeleteChat(c.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              );
            })()}
          </div>
        </div>

        {/* Footer Indicators */}
        <div className="p-3 border-t border-white/5 bg-transparent space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Secured Server Proxy
            </span>
            <span className="bg-white/5 border border-white/5 rounded px-1.5 py-0.5 text-[10px] text-slate-400">
              VITE+EXPRESS
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Model: PolitiChat-3.5</span>
            <span>Grounding: Search Enabled</span>
          </div>
        </div>
      </aside>

      {/* MAIN WORK WINDOW */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-transparent relative">
        
        {/* Top Header Controls */}
        <header className="flex h-16 items-center justify-between px-4 border-b border-white/5 bg-black/15 backdrop-blur-md relative z-30">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="mr-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-250 hover:bg-white/5 border border-white/10 cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-display font-medium text-slate-200 text-sm truncate">
                  {activeConv?.title || "PolitiChat GPT - Political Intelligence Coach"}
                </h2>
                {PRESETS.some(p => p.id === activeConvId) && (
                  <span className="bg-blue-600/10 text-blue-400 border border-blue-500/20 text-[9.5px] px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wide">
                    Reference Model
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-slate-400 hidden sm:block">
                Authorized Global Political Integrity Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeConv && activeConv.messages.length > 0 && (
              <button
                id="btn-export-pdf"
                onClick={() => exportConversationToPDF(activeConv)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-lg font-mono transition-all cursor-pointer"
                title="Export Formatted Research PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            )}
            <button
              id="btn-workspace-dashboard"
              onClick={() => setIsIntegrationsOpen(!isIntegrationsOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-lg font-mono transition-all cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>🔌 Workspace Sync ({currentUser ? "Cloud Sync" : "Local Mode"})</span>
            </button>
            <button
              onClick={() => setIsConfigDrawerOpen(!isConfigDrawerOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#38bdf8] bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 border border-[#38bdf8]/25 rounded-lg font-mono transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              🔧 Config Playground
            </button>
          </div>
        </header>

        {/* Dynamic Navigation Tabs */}
        <div className="flex border-b border-white/5 bg-black/10 px-6 py-2.5 items-center justify-between relative z-20">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-605/15"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Dialogue Console</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('monitor');
                setMonitorPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'monitor'
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-605/15"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>State & UT Safety Monitor</span>
              <span className="bg-white/10 text-[10px] px-2 py-0.5 rounded-full font-mono text-slate-350 border border-white/5">
                {politicalRecords.length}
              </span>
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-[10px] font-mono tracking-widest text-slate-500 uppercase hidden md:flex">
            <span>Grounding Sources: Loaded</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
        </div>

        {/* Workspace Panels: Messages view vs Empty Welcomer */}
        {activeTab === 'chat' ? (
          <>
            <div className="flex-grow overflow-y-auto px-4 py-6 md:px-8 max-w-5xl mx-auto w-full">
          {!activeConv || activeConv.messages.length === 0 ? (
            
            // Empty Dashboard Area / Pre-loaded Options (Microsoft Copilot design style)
            <div className="min-h-[70vh] flex flex-col justify-center py-10">
              
              <div className="text-center max-w-2xl mx-auto mb-10 space-y-5">
                <div className="flex flex-col items-center justify-center gap-3">
                  <PolitiChatWovenStar className="w-16 h-16 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.25)] text-blue-500 animate-spin-slow" />
                  <div className="text-center">
                    <p className="text-[10px] font-mono font-bold text-blue-400 tracking-widest uppercase">
                      PolitiChat GPT Intelligence
                    </p>
                    <p className="text-[8px] font-mono text-slate-500 tracking-wider uppercase">
                      SECURED COGNITIVE ENGINE
                    </p>
                  </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-[#f8fafc]">
                  Global Political integrity Suite
                </h1>
                <p className="text-sm text-slate-400 font-sans leading-relaxed">
                  Welcome to **PolitiChat**, an unbiased political analyzer, candidate platform tracker, and news verification suite. Use natural dialogue to clarify voting logistics, audit news reports, track politicians' claims, and debunk fake news globally.
                </p>
              </div>

              {/* Suggestions Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
                
                <button
                  onClick={() => handleSend("Please perform an objective analysis of the current French political landscape, party alignments, and major candidates.")}
                  className="flex gap-4 p-4 rounded-2xl glass-card glass-card-hover text-left group shadow cursor-pointer"
                >
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-blue-600/15 flex items-center justify-center text-blue-400 group-hover:bg-blue-600/25 transition-all flex-shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-medium text-slate-200 text-sm mb-1 group-hover:text-blue-400 flex items-center gap-1">
                      Analyze France's Politics
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Compare political manifestos, coalition dynamics, and electoral mechanics.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => handleSend("What are the latest developments and verified leadership reports regarding the Chief Minister or political administration of Tamil Nadu? Please use live search if active.")}
                  className="flex gap-4 p-4 rounded-2xl glass-card glass-card-hover text-left group shadow cursor-pointer"
                >
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-emerald-600/15 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600/25 transition-all flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-medium text-slate-200 text-sm mb-1 group-hover:text-emerald-400 flex items-center gap-1">
                      Verify Tamil Nadu Leadership
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Retrieve actual local administrative leadership stats with live grounding checks.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => handleSend("How are foreign propaganda campaigns, deepfakes, and generative narrative bias evaluated by safety models globally? Give a comprehensive review.")}
                  className="flex gap-4 p-4 rounded-2xl glass-card glass-card-hover text-left group shadow cursor-pointer"
                >
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-indigo-600/15 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600/25 transition-all flex-shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-medium text-slate-200 text-sm mb-1 group-hover:text-indigo-400 flex items-center gap-1">
                      Audit Media Bias & Fake News
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Investigate digital manipulation vectors and strategic election integrity shields.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => handleSend("Provide an educational comparison between ranked-choice voting, proportional representation, and first-past-the-post systems.")}
                  className="flex gap-4 p-4 rounded-2xl glass-card glass-card-hover text-left group shadow cursor-pointer"
                >
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-orange-600/15 flex items-center justify-center text-orange-400 group-hover:bg-orange-600/25 transition-all flex-shrink-0">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-medium text-slate-200 text-sm mb-1 group-hover:text-orange-400 flex items-center gap-1">
                      Explain Global Voting Methods
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Explore structural design advantages, ballot counting, and country setups.
                    </p>
                  </div>
                </button>

              </div>

            </div>
          ) : (
            
            // Conversation Message Thread
            <div className="w-full">
              {activeConv.messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Interactive Bottom Input Segment */}
        <footer className="border-t border-white/5 bg-[#0a0f1d]/40 backdrop-blur-md p-4">
          <div className="max-w-4xl mx-auto space-y-3">
            
            {/* Input fields */}
            <div className="relative flex items-center glass-card rounded-2xl focus-within:ring-2 ring-blue-500/35 px-4 py-2">
              <textarea
                id="input-text-area"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask model or draft follow-up specs... (e.g., 'Draft a presentation slide set')"
                rows={1}
                className="w-full bg-transparent border-0 outline-none resize-none focus:ring-0 text-sm py-2 pr-10 text-slate-200 placeholder-slate-500 min-h-[40px] max-h-[150px] overflow-y-auto"
                disabled={isGenerating}
              />
              <button
                id="btn-send-message"
                onClick={() => handleSend()}
                disabled={isGenerating || !inputText.trim()}
                className={`absolute right-3 p-2 rounded-xl border transition-all cursor-pointer ${
                  inputText.trim() && !isGenerating
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-95"
                    : "bg-slate-800 border-slate-700/50 text-slate-500 cursor-not-allowed"
                }`}
                title="Send instruction Prompt"
              >
                {isGenerating ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-300" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Micro details panel below messaging area */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                  <Shield className="w-3.5 h-3.5" />
                  Injection Filter: Active
                </span>
                <span className="flex items-center gap-1.5 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Jitter Retries: Available
                </span>
              </div>
              <div className="text-slate-500">
                Type normally inside box and press <kbd className="px-1.5 py-0.5 rounded bg-slate-850 text-slate-400 border border-slate-800 text-[9px] shadow-sm font-sans">Enter</kbd> to stream
              </div>
            </div>

          </div>
        </footer>
          </>
        ) : (
          /* STATE & UT SAFETY MONITOR PANEL (Interactive 100-row Database) */
          <div className="flex-grow flex flex-col bg-[#050814]/40 overflow-y-auto p-4 md:p-6 space-y-6">
            
            {/* Header Metrics Summaries */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
              
              <div className="p-4 rounded-2xl bg-black/35 border border-white/5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Territories Active</span>
                  <Globe className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-blue-50">{Array.from(new Set(politicalRecords.map(r => r.state))).length}</span>
                  <span className="text-xs text-slate-500 font-mono">of 36</span>
                </div>
                <p className="text-[9.5px] text-slate-500 font-sans">Comprehensive State and UT coverage</p>
              </div>

              <div className="p-4 rounded-2xl bg-black/35 border border-white/5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Election & Assembly</span>
                  <Compass className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-emerald-50">
                    {politicalRecords.filter(r => r.type === "Election Process" || r.type === "Assembly Politics").length}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">claims</span>
                </div>
                <p className="text-[9.5px] text-slate-500 font-sans">Electoral system and ballot mechanics</p>
              </div>

              <div className="p-4 rounded-2xl bg-black/35 border border-white/5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Disputes & Triggers</span>
                  <AlertOctagon className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-orange-50">
                    {politicalRecords.filter(r => r.type === "Governance/Clash" || r.type === "Policy Protest" || r.type === "Security/Unrest").length}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">debates</span>
                </div>
                <p className="text-[9.5px] text-slate-500 font-sans">Regional flashpoints & policy reviews</p>
              </div>

              <div className="p-4 rounded-2xl bg-black/35 border border-white/5 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Audited Citations</span>
                  <FileText className="w-4 h-4 text-sky-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-sky-50">
                    {politicalRecords.filter(r => r.type === "Administrative Audit" || r.type === "Dissent & Coalition").length}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">citations</span>
                </div>
                <p className="text-[9.5px] text-slate-500 font-sans font-normal">Verified press and statutory tables</p>
              </div>

            </div>

            {/* Filter controls row */}
            <div className="flex flex-col gap-3 py-4 px-4 bg-black/20 border border-white/5 rounded-2xl font-sans">
              
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-blue-500" />
                  DATABASE RUN CONTROL ({politicalRecords.length} ROWS CONFIGURED)
                </h3>
                
                <button
                  id="btn-report-manual-dispute"
                  onClick={() => setIsReportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 rounded-xl transition-all font-semibold shadow-sm cursor-pointer animate-pulse"
                >
                  <Plus className="w-4 h-4" />
                  <span>Report New Dispute Entry</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Search query fields */}
                <div className="md:col-span-6 relative">
                  <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    placeholder="Search State/UT, issue keyword, specific news source..."
                    type="text"
                    value={monitorSearch}
                    onChange={(e) => {
                      setMonitorSearch(e.target.value);
                      setMonitorPage(1);
                    }}
                    className="w-full bg-[#050814]/70 border border-white/5 hover:border-slate-750 focus:border-blue-500 text-xs rounded-xl pl-9 pr-4 py-2.5 outline-none text-slate-200 transition-all placeholder-slate-500"
                  />
                  {monitorSearch && (
                    <button
                      onClick={() => {
                        setMonitorSearch("");
                        setMonitorPage(1);
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-[10px] font-mono cursor-pointer"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                {/* State/UT drop filters info */}
                <div className="md:col-span-3">
                  <select
                    value={monitorStateFilter}
                    onChange={(e) => {
                      setMonitorStateFilter(e.target.value);
                      setMonitorPage(1);
                    }}
                    className="w-full bg-[#050814]/70 border border-white/5 focus:border-blue-500 text-xs rounded-xl px-3 py-2.5 text-slate-300 outline-none transition-all cursor-pointer"
                  >
                    <option value="All">🔍 All States & UTs (36)</option>
                    {INDIAN_STATES_UTS.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* Category selectors */}
                <div className="md:col-span-3">
                  <select
                    value={monitorTypeFilter}
                    onChange={(e) => {
                      setMonitorTypeFilter(e.target.value);
                      setMonitorPage(1);
                    }}
                    className="w-full bg-[#050814]/70 border border-white/5 focus:border-blue-500 text-xs rounded-xl px-3 py-2.5 text-slate-300 outline-none transition-all cursor-pointer"
                  >
                    <option value="All">📁 All Categories (7)</option>
                    <option value="Election Process">Election Process</option>
                    <option value="Assembly Politics">Assembly Politics</option>
                    <option value="Governance/Clash">Governance/Clash</option>
                    <option value="Dissent & Coalition">Dissent & Coalition</option>
                    <option value="Security/Unrest">Security/Unrest</option>
                    <option value="Policy Protest">Policy Protest</option>
                    <option value="Administrative Audit">Administrative Audit</option>
                  </select>
                </div>

              </div>

            </div>

            {/* Results Rendering Table Area */}
            {(() => {
              const matchedRecords = politicalRecords.filter((rec) => {
                const termStr = `${rec.state} ${rec.issue} ${rec.recentItem} ${rec.source}`.toLowerCase();
                const matchedSearch = termStr.includes(monitorSearch.toLowerCase());
                const matchedState = monitorStateFilter === "All" || rec.state === monitorStateFilter;
                const matchedType = monitorTypeFilter === "All" || rec.type === monitorTypeFilter;
                return matchedSearch && matchedState && matchedType;
              });

              // Page segmentations
              const idxPerPage = 12;
              const totalPages = Math.ceil(matchedRecords.length / idxPerPage) || 1;
              const currPageRef = Math.max(1, Math.min(monitorPage, totalPages));
              const startIdx = (currPageRef - 1) * idxPerPage;
              const endIdx = startIdx + idxPerPage;
              const pageRecords = matchedRecords.slice(startIdx, endIdx);

              const getBadgeStyles = (type: string) => {
                switch (type) {
                  case "Election Process":
                    return "text-purple-400 bg-purple-500/10 border-purple-500/20";
                  case "Assembly Politics":
                    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                  case "Governance/Clash":
                    return "text-orange-400 bg-orange-500/10 border-orange-500/20";
                  case "Dissent & Coalition":
                    return "text-amber-400 bg-amber-500/10 border-amber-500/20";
                  case "Security/Unrest":
                    return "text-red-400 bg-red-400/10 border-red-500/25";
                  case "Policy Protest":
                    return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
                  case "Administrative Audit":
                  default:
                    return "text-sky-400 bg-sky-500/10 border-sky-500/20";
                }
              };

              return (
                <div className="space-y-4">
                  
                  {matchedRecords.length === 0 ? (
                    <div className="py-12 text-center space-y-2 border border-dashed border-white/5 rounded-2xl bg-black/10">
                      <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-sm font-semibold text-slate-300 font-sans">No political records found matching filters</p>
                      <p className="text-xs text-slate-555 font-sans">Refine search text query or clear state filters.</p>
                      { (monitorSearch || monitorStateFilter !== "All" || monitorTypeFilter !== "All") && (
                        <button
                          onClick={() => {
                            setMonitorSearch("");
                            setMonitorStateFilter("All");
                            setMonitorTypeFilter("All");
                            setMonitorPage(1);
                          }}
                          className="mt-3 text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 py-1.5 px-3 rounded-lg cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table Layout */}
                      <div className="hidden lg:block overflow-x-auto rounded-2xl border border-white/5 bg-black/25">
                        <table id="political-database-run-table" className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-white/[0.03] border-b border-white/5 text-slate-400 font-mono text-[10.5px] uppercase tracking-wider">
                              <th className="p-4 w-[160px]">State / UT</th>
                              <th className="p-4 w-[160px]">Dispute Category</th>
                              <th className="p-4">Political Dispute Details</th>
                              <th className="p-4 w-[120px]">Timeframe</th>
                              <th className="p-4 w-[150px]">Asserted Source</th>
                              <th className="p-4 text-right w-[180px]">Cabinet Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {pageRecords.map((r) => (
                              <tr key={r.id} className="hover:bg-white/[0.02] transition-colors leading-relaxed group">
                                <td className="p-4 align-top font-semibold text-slate-205">
                                  <span className="bg-blue-600/10 text-blue-400 font-mono text-[9px] tracking-wide uppercase px-2 py-0.5 rounded border border-blue-500/20 whitespace-normal block text-center">
                                    {r.state}
                                  </span>
                                </td>
                                <td className="p-4 align-top">
                                  <span className={`inline-block border text-[9.5px] font-medium px-2 py-0.5 rounded-md ${getBadgeStyles(r.type)}`}>
                                    {r.type}
                                  </span>
                                </td>
                                <td className="p-4 align-top space-y-1">
                                  <h4 className="font-semibold text-slate-200 text-xs leading-normal">{r.issue}</h4>
                                  <p className="text-slate-400 text-xs font-sans font-light leading-relaxed">{r.recentItem}</p>
                                </td>
                                <td className="p-4 align-top text-slate-400 font-mono text-[10px] whitespace-nowrap">{r.date || "Ongoing"}</td>
                                <td className="p-4 align-top font-mono text-[10px] text-slate-350">
                                  <span className="flex items-center gap-1.5 font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                    {r.source}
                                  </span>
                                </td>
                                <td className="p-4 align-top text-right">
                                  <div className="flex justify-end items-center gap-1.5">
                                    <button
                                      onClick={() => handleAuditClick(r)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 rounded-lg text-[10.5px] font-medium transition-all cursor-pointer shadow-md"
                                      title="Run full factual audit check on this development"
                                    >
                                      <Sparkles className="w-3 h-3 text-blue-200 animate-pulse" />
                                      <span>Audit AI</span>
                                    </button>
                                    <button
                                      id={`btn-del-record-${r.id}`}
                                      onClick={() => handleDeleteRecord(r.id)}
                                      className="p-1.5 bg-white/5 border border-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                      title="Delete entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card Grid Layout */}
                      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pageRecords.map((r) => (
                          <div key={r.id} className="p-4 rounded-2xl bg-black/25 border border-white/5 space-y-3 hover:border-slate-850 transition-colors">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="bg-blue-600/10 text-blue-400 border border-blue-500/20 font-mono text-[9px] tracking-wider px-2 py-0.5 rounded">
                                {r.state}
                              </span>
                              <span className={`border text-[9px] font-medium px-2 py-0.5 rounded-md ${getBadgeStyles(r.type)}`}>
                                {r.type}
                              </span>
                            </div>
                            
                            <div className="space-y-1">
                              <h4 className="font-semibold text-slate-200 text-xs leading-normal">{r.issue}</h4>
                              <p className="text-slate-400 text-xs font-sans font-light leading-normal">{r.recentItem}</p>
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-white/5">
                              <span>📅 {r.date}</span>
                              <span className="truncate max-w-[150px]">📰 {r.source}</span>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                              <button
                                onClick={() => handleAuditClick(r)}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-md"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Audit AI</span>
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(r.id)}
                                className="p-2 bg-white/5 border border-white/5 rounded-lg text-slate-400 hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination Controls bar */}
                      <div className="flex items-center justify-between py-4 border-t border-white/5 text-[11px] text-slate-400 font-mono">
                        <div>
                          Showing <span className="font-semibold text-slate-200">{startIdx + 1}</span> to{" "}
                          <span className="font-semibold text-slate-200">{Math.min(endIdx, matchedRecords.length)}</span> of{" "}
                          <span className="font-semibold text-slate-200">{matchedRecords.length}</span> political entries
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            id="btn-prev-page"
                            disabled={currPageRef === 1}
                            onClick={() => {
                              setMonitorPage(currPageRef - 1);
                              const tableEl = document.getElementById("political-database-run-table");
                              if (tableEl) tableEl.scrollIntoView({ behavior: "smooth" });
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-[10.5px] transition-all cursor-pointer ${
                              currPageRef === 1
                                ? "bg-slate-800/10 border-slate-800/30 text-slate-500 cursor-not-allowed"
                                : "bg-black/35 border-white/5 text-slate-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            Previous
                          </button>
                          
                          <span className="px-2 font-mono">
                            Page <span className="text-slate-100">{currPageRef}</span> / <span className="text-slate-400">{totalPages}</span>
                          </span>
                          
                          <button
                            id="btn-next-page"
                            disabled={currPageRef === totalPages}
                            onClick={() => {
                              setMonitorPage(currPageRef + 1);
                              const tableEl = document.getElementById("political-database-run-table");
                              if (tableEl) tableEl.scrollIntoView({ behavior: "smooth" });
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-[10.5px] transition-all cursor-pointer ${
                              currPageRef === totalPages
                                ? "bg-slate-800/10 border-slate-800/10 text-slate-500 cursor-not-allowed"
                                : "bg-black/35 border-white/5 text-slate-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            Next
                          </button>
                        </div>
                      </div>

                    </>
                  )}

                </div>
              );
            })()}

          </div>
        )}

        {/* MANUALLY REPORT DISPUTE INPUT MODAL OVERLAY */}
        {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Dark glass backdrop layout */}
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
              onClick={() => setIsReportModalOpen(false)}
            />
            
            {/* Modal Box */}
            <div className="relative w-full max-w-xl bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-10 animate-slide-in">
              
              {/* Modal header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0a0f1d]">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-500" />
                  <div>
                    <h3 className="text-xs font-mono font-bold text-slate-200">REPORT NEW LOCAL DISPUTE</h3>
                    <p className="text-[10px] text-slate-500 font-sans">Submit claim structures for the active regional workspace monitor</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form fields content */}
              <form onSubmit={handleAddRecord} className="p-5 overflow-y-auto space-y-4 font-sans">
                
                {/* State/UT and dispute Category selection row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-mono font-bold text-slate-400 uppercase tracking-wide">State / Union Territory *</label>
                    <select
                      value={formState}
                      onChange={(e) => setFormState(e.target.value)}
                      className="w-full bg-[#050814] border border-[#1e293b] focus:border-blue-500 text-xs rounded-xl p-2.5 text-slate-300 outline-none transition-all cursor-pointer"
                    >
                      {INDIAN_STATES_UTS.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10.5px] font-mono font-bold text-slate-400 uppercase tracking-wide">Focus Category *</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as any)}
                      className="w-full bg-[#050814] border border-[#1e293b] focus:border-blue-500 text-xs rounded-xl p-2.5 text-slate-300 outline-none transition-all cursor-pointer"
                    >
                      <option value="Election Process">Election Process</option>
                      <option value="Assembly Politics">Assembly Politics</option>
                      <option value="Governance/Clash">Governance/Clash</option>
                      <option value="Dissent & Coalition">Dissent & Coalition</option>
                      <option value="Security/Unrest">Security/Unrest</option>
                      <option value="Policy Protest">Policy Protest</option>
                      <option value="Administrative Audit">Administrative Audit</option>
                    </select>
                  </div>
                </div>

                {/* Political dispute details */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-mono font-bold text-slate-400 uppercase tracking-wide">Dispute Title / Core Issue *</label>
                  <input
                    placeholder="e.g., General Assembly electoral threshold dispute"
                    type="text"
                    required
                    value={formIssue}
                    onChange={(e) => setFormIssue(e.target.value)}
                    className="w-full bg-[#050814] border border-[#1e293b] focus:border-blue-500 text-xs rounded-xl p-2.5 outline-none text-slate-200 transition-all placeholder-slate-600 font-sans"
                  />
                </div>

                {/* Dispute Recent Item details */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-mono font-bold text-slate-400 uppercase tracking-wide">Recent Development Details *</label>
                  <textarea
                    placeholder="Provide realistic summary details on what occurred, assertions made by regional parties, and direct consequences..."
                    required
                    rows={4}
                    value={formRecentItem}
                    onChange={(e) => setFormRecentItem(e.target.value)}
                    className="w-full bg-[#050814] border border-[#1e293b] focus:border-blue-500 text-xs rounded-xl p-2.5 outline-none text-slate-200 leading-relaxed font-sans placeholder-slate-600"
                  />
                </div>

                {/* Dates and sources references */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-mono font-bold text-slate-400 uppercase tracking-wide">Approximate Date (e.g. YYYY-MM)</label>
                    <input
                      placeholder="e.g., 2026-06"
                      type="text"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-[#050814] border border-[#1e293b] focus:border-blue-500 text-xs rounded-xl p-2.5 outline-none text-slate-200 transition-all placeholder-slate-600 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10.5px] font-mono font-bold text-slate-400 uppercase tracking-wide">Asserted Media / Press Source *</label>
                    <input
                      placeholder="e.g., NDTV, Indian Express"
                      type="text"
                      required
                      value={formSource}
                      onChange={(e) => setFormSource(e.target.value)}
                      className="w-full bg-[#050814] border border-[#1e293b] focus:border-blue-500 text-xs rounded-xl p-2.5 outline-none text-slate-200 transition-all placeholder-slate-600 font-sans"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] text-slate-500 leading-normal font-sans">
                    * Required fields. Newly submitted entries are stored in your active browser regional storage layer, enabling live dashboard statistics updates.
                  </p>
                </div>

                {/* Form buttons triggers */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    className="px-4 py-2 border border-white/5 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl text-xs transition-all cursor-pointer font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/10 transition-all active:scale-98 cursor-pointer"
                  >
                    Submit Entry
                  </button>
                </div>

              </form>

            </div>

          </div>
        )}

        {/* SLIDING CONFIG DRAWER (RIGHT PANEL) */}
        {isConfigDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-[#050814]/75 backdrop-blur-xs transition-opacity"
              onClick={() => setIsConfigDrawerOpen(false)}
            />
            {/* Panel */}
            <div className="relative w-full max-w-lg bg-[#0a0f1d] border-l border-[#1e293b] shadow-2xl flex flex-col h-full z-10 transition-transform duration-300 animate-slide-in">
              
              {/* Drawer Title */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b]/50">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-400 animate-spin-slow" />
                  <h3 className="font-display font-semibold text-[#f8fafc] text-sm">
                    Prompt Config Playground
                  </h3>
                </div>
                <button
                  onClick={() => setIsConfigDrawerOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-[#f8fafc] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Editable inputs */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6">
                
                {/* System Prompt Control */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider font-mono font-bold text-slate-400 flex items-center justify-between">
                    <span>Model System Instruction</span>
                    <button
                      onClick={handleResetConfigInputs}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reset to Default Template
                    </button>
                  </label>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                    Configure instructions mapping the AI persona, refusal rules, non-negotiable goals and trusted ECI data boundaries.
                  </p>
                  <textarea
                    id="system-instruction-input"
                    value={systemInstructionInput}
                    onChange={(e) => setSystemInstructionInput(e.target.value)}
                    rows={12}
                    className="w-full text-xs font-mono bg-[#050814] border border-[#1e293b] rounded-xl p-3 focus:outline-none focus:border-blue-500 leading-relaxed text-slate-300"
                    placeholder="Input system instruction constraints..."
                  />
                </div>

                {/* Model Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      Active Gemini Model
                    </label>
                    <select
                      id="select-model"
                      value={modelSelect}
                      onChange={(e) => setModelSelect(e.target.value)}
                      className="w-full bg-[#050814] text-xs border border-[#1e293b] rounded-xl p-2.5 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (Fast)</option>
                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Deep)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider font-mono font-bold text-slate-400 flex items-center justify-between">
                      <span>Temperature</span>
                      <span className="text-[11px] text-[#3b82f6] font-mono leading-none">{temperatureVal}</span>
                    </label>
                    <input
                      id="input-temperature"
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.1"
                      value={temperatureVal}
                      onChange={(e) => setTemperatureVal(Number(e.target.value))}
                      className="w-full accent-blue-600 h-2 bg-[#050814] rounded-lg cursor-pointer"
                    />
                  </div>

                </div>

                {/* Google Search Grounding Toggle */}
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-xs font-bold text-blue-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        Web Grounding Engine
                      </label>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Cross-reference realtime facts via live Google Search.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableGoogleSearch}
                        onChange={(e) => setEnableGoogleSearch(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-blue-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-950/50 peer-checked:border-blue-500 border border-slate-700"></div>
                    </label>
                  </div>
                  {enableGoogleSearch ? (
                    <div className="text-[10px] font-mono text-blue-300 bg-blue-500/10 p-2 rounded-lg border border-blue-500/15 leading-relaxed">
                      💡 <strong>Active Grounding Mode:</strong> High-risk political facts, live news queries, and real-time leadership facts will bypass strict refusal constraints and consult Google Search.
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-slate-500 leading-relaxed">
                      🔒 <strong>Strict RAG Mode:</strong> Safe, zero-hallucination isolation. The assistant replies using only your pre-loaded civic files, adhering strictly to Asian AI Safety guidelines.
                    </div>
                  )}
                </div>

                {/* Security Parameter Sheet */}
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-orange-400 tracking-wider uppercase font-mono">
                    <AlertOctagon className="w-4 h-4" />
                    Security Framework Notice
                  </h4>
                  <p className="text-[11.5px] text-slate-400 leading-relaxed">
                    This playground validates the security filters on the Express node endpoints. When making queries, the system instructions listed above will be injected into the GenAI request pipeline.
                  </p>
                </div>

              </div>

              {/* Save & Apply bar */}
              <div className="p-4 border-t border-[#1e293b]/50 bg-[#070b14] flex gap-3">
                <button
                  onClick={() => setIsConfigDrawerOpen(false)}
                  className="flex-1 rounded-xl py-2 px-4 border border-[#1e293b]/80 hover:bg-slate-800 text-xs font-medium transition-all text-slate-400 active:scale-95 cursor-pointer max-w-xs"
                >
                  Cancel
                </button>
                <button
                  id="btn-apply-config"
                  onClick={handleSaveActiveConfig}
                  className="flex-grow rounded-xl py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Apply & Save Config
                </button>
              </div>

            </div>
          </div>
        )}
        {isIntegrationsOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <div
              className="absolute inset-0 bg-[#050814]/75 backdrop-blur-xs transition-opacity"
              onClick={() => setIsIntegrationsOpen(false)}
            />
            <div className="relative w-full max-w-xl bg-[#0a0f1d] border-l border-[#1e293b] shadow-2xl flex flex-col h-full z-10 transition-transform duration-300 animate-slide-in">
              
              {/* Drawer Title */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b]/50">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <h3 className="font-display font-semibold text-[#f8fafc] text-sm">
                    Google Workspace & Firebase Hub
                  </h3>
                </div>
                <button
                  onClick={() => setIsIntegrationsOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-[#f8fafc] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contents Area */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6">
                
                {/* 1. AUTHENTICATION HUB */}
                <div className="p-4 rounded-xl border border-[#1e293b] bg-white/[0.02] space-y-4">
                  <h4 className="text-xs uppercase tracking-wider font-mono font-bold text-slate-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-400" />
                    Authentication status
                  </h4>

                  {!currentUser ? (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-400 leading-relaxed">
                        To persist safety research logs, export documents to Google Drive, send alerts via Gmail, or update Google Sheets, you must authorize your Google Workspace account with secure Firebase credentials.
                      </p>
                      
                      {/* GSI Material Styled Button */}
                      <button 
                        onClick={handleGoogleLogin}
                        className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-white text-slate-800 rounded-xl hover:bg-slate-100 font-sans font-medium text-xs shadow-lg transition-transform active:scale-98 cursor-pointer"
                      >
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        </svg>
                        <span>Sign in with Google</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <div className="flex items-center gap-3">
                        {currentUser.photoURL ? (
                          <img 
                            src={currentUser.photoURL} 
                            alt={currentUser.displayName || ""} 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full border border-blue-500/20"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                            {(currentUser.displayName || "G").charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-[#f8fafc]">{currentUser.displayName || "Connected User"}</p>
                          <p className="text-[10px] font-mono text-blue-400 truncate">{currentUser.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleGoogleLogout}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                        title="Sign Out"
                      >
                        <LogOut className="w-4 h-4" style={{ display: "inline" }} />
                      </button>
                    </div>
                  )}
                </div>

                {currentUser && (
                  <>
                    {/* FIRESTORE DYNAMIC PERSISTENCE STATE */}
                    <div className="p-4 rounded-xl border border-[#1e293b] bg-emerald-500/[0.01] space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs uppercase tracking-wider font-mono font-bold text-slate-400 flex items-center gap-1.5">
                          <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                          Firestore Database Sync
                        </h4>
                        <span className="flex items-center gap-1 font-mono text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 uppercase tracking-wide">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Connected
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                        All safety dispatches, custom prompt matrices, and dialogue reviews are automatically tracked and persistent in real-time in Firestore for security audits. Handled under credentials: <span className="font-mono text-[10px] text-slate-300 bg-white/5 px-1 py-0.5 rounded">{currentUser.uid.substring(0, 8)}...</span>
                      </p>
                    </div>

                    {/* 2. GOOGLE SHEETS */}
                    <div className="p-4 rounded-xl border border-[#1e293b] bg-[#10b981]/5 space-y-3">
                      <h4 className="text-xs uppercase tracking-wider font-mono font-bold text-[#10b981] flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Google Sheets Safe Logs
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Log the currently active model run (prompts, temperature configurations, AI evaluation refusal verdicts) directly to a live spreadsheet.
                      </p>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">Target Spreadsheet</label>
                          {availableSheets.length > 0 ? (
                            <select
                              value={targetSpreadsheetId}
                              onChange={(e) => setTargetSpreadsheetId(e.target.value)}
                              className="w-full bg-[#050814] text-xs border border-[#1e293b] rounded-xl p-2 text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                              <option value="">-- Create Newly Formatted Spreadsheet --</option>
                              {availableSheets.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-[10px] text-slate-500 italic">No existing spreadsheets found. A new one will be autogenerated upon submission.</p>
                          )}
                        </div>

                        <button
                          onClick={handleLogToSpreadsheet}
                          disabled={isLoggingSheet || !activeConv}
                          className="w-full py-2 px-3 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 transition-all cursor-pointer"
                        >
                          {isLoggingSheet ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          )}
                          <span>Log Current Analysis to Sheets</span>
                        </button>

                        {lastSheetLogStatus && (
                          <div className="p-2.5 rounded-lg bg-black/30 border border-emerald-500/10 text-[10px] font-mono text-emerald-400 mt-1">
                            {lastSheetLogStatus}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. GOOGLE DRIVE */}
                    <div className="p-4 rounded-xl border border-[#1e293b] bg-amber-500/5 space-y-3">
                      <h4 className="text-xs uppercase tracking-wider font-mono font-bold text-amber-500 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        Google Drive Export
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Export a fully annotated, formatted research PDF of this conversation history directly into your Google Drive files.
                      </p>

                      <div className="space-y-2">
                        <button
                          onClick={handleUploadPdfToDrive}
                          disabled={isSavingToDrive || !activeConv}
                          className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 transition-all cursor-pointer"
                        >
                          {isSavingToDrive ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>Upload PDF Report to Drive</span>
                        </button>

                        {driveUploadStatus && (
                          <div className="p-2.5 rounded-lg bg-black/30 border border-amber-500/10 text-[10px] font-mono text-amber-400">
                            {driveUploadStatus}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4. GMAIL REPORT DISPATCH */}
                    <div className="p-4 rounded-xl border border-[#1e293b] bg-indigo-500/5 space-y-3">
                      <h4 className="text-xs uppercase tracking-wider font-mono font-bold text-indigo-400 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        Gmail Alert Coordinator
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Dispatch safety summaries or compliance warnings directly to secure security stakeholders using Gmail.
                      </p>

                      <div className="space-y-3 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">Recipients (Email)</label>
                          <input
                            type="email"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            placeholder="officer@company.com"
                            className="w-full bg-[#050814] border border-[#1e293b] rounded-xl p-2 text-slate-300 focus:outline-none focus:border-indigo-500 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">Email Subject</label>
                          <input
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            className="w-full bg-[#050814] border border-[#1e293b] rounded-xl p-2 text-slate-300 focus:outline-none focus:border-indigo-500 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">Email content</label>
                          <textarea
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            rows={3}
                            className="w-full bg-[#050814] border border-[#1e293b] rounded-xl p-2 text-slate-300 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed text-xs"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="emailAttachPdf"
                            checked={emailAttachPdf}
                            onChange={(e) => setEmailAttachPdf(e.target.checked)}
                            className="rounded accent-indigo-500 cursor-pointer"
                          />
                          <label htmlFor="emailAttachPdf" className="text-[11px] text-slate-300 cursor-pointer select-none">
                            Attach formatted PDF report file dynamically
                          </label>
                        </div>

                        <button
                          onClick={handleSendGmailReport}
                          disabled={isEmailSending || !emailTo.trim() || !activeConv}
                          className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 transition-all cursor-pointer"
                        >
                          {isEmailSending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Mail className="w-3.5 h-3.5" />
                          )}
                          <span>Send Email Dispatch</span>
                        </button>

                        {emailStatus && (
                          <div className="p-2.5 rounded-lg bg-black/30 border border-indigo-500/10 text-[10px] font-mono text-indigo-400">
                            {emailStatus}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 5. GOOGLE CHAT MESSAGE BROADCAST */}
                    <div className="p-4 rounded-xl border border-[#1e293b] bg-sky-500/5 space-y-3">
                      <h4 className="text-xs uppercase tracking-wider font-mono font-bold text-sky-400 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Google Chat Alerts
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Broadcast critical Refusal Overrides or Jailbreak assessments directly to your shared Google Chat Spaces.
                      </p>

                      <div className="space-y-3 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">Target Space Channel</label>
                          {availableChatSpaces.length > 0 ? (
                            <select
                              value={targetChatSpace}
                              onChange={(e) => setTargetChatSpace(e.target.value)}
                              className="w-full bg-[#050814] text-xs border border-[#1e293b] rounded-xl p-2 text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer text-xs"
                            >
                              {availableChatSpaces.map(sp => (
                                <option key={sp.name} value={sp.name}>{sp.displayName || sp.name}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-[10px] text-slate-500 italic">No accessible chat spaces discovered in this Google scope model.</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">Dynamic Alert Message</label>
                          <textarea
                            value={chatMessageText}
                            onChange={(e) => setChatMessageText(e.target.value)}
                            placeholder="Leave blank to post automatically compiled safety incident summaries..."
                            rows={2}
                            className="w-full bg-[#050814] border border-[#1e293b] rounded-xl p-2 text-slate-300 focus:outline-none focus:border-sky-500 font-sans leading-relaxed text-xs"
                          />
                        </div>

                        <button
                          onClick={handleSendChatMessage}
                          disabled={isChatSending || !targetChatSpace || !activeConv}
                          className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 transition-all cursor-pointer"
                        >
                          {isChatSending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5" />
                          )}
                          <span>Post Alert to Google Chat</span>
                        </button>

                        {chatStatus && (
                          <div className="p-2.5 rounded-lg bg-black/30 border border-sky-500/10 text-[10px] font-mono text-sky-400">
                            {chatStatus}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Close Footer bar */}
              <div className="p-4 border-t border-[#1e293b]/50 bg-[#070b14] flex">
                <button
                  onClick={() => setIsIntegrationsOpen(false)}
                  className="w-full rounded-xl py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-all cursor-pointer text-center"
                >
                  Close & Resume Research
                </button>
              </div>

            </div>
          </div>
        )}

        {/* GUIDELINES SPEC MODAL (CENTER OVERLAY) */}
        {isGuidelinesOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity"
              onClick={() => setIsGuidelinesOpen(false)}
            />
            {/* Panel */}
            <div className="relative w-full max-w-4xl bg-[#0a0f1d] border border-[#1e293b] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] z-10 animate-fade-in overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e293b]/50">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-display font-semibold text-[#f8fafc] text-sm md:text-base">
                      🎓 PolitiChat Safety Guidelines & Reference Specs
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Select any of our 15 pre-loaded research blueprints. Opening a specification card configures your workspace with its direct focus prompt.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGuidelinesOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-[#f8fafc] cursor-pointer transition-all border border-transparent hover:border-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid Contents */}
              <div className="flex-grow overflow-y-auto p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {PRESETS.map((p) => {
                  const isActive = activeConvId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        handleSelectPreset(p);
                        setIsGuidelinesOpen(false);
                      }}
                      className={`flex flex-col text-left p-5 rounded-2xl transition-all border outline-none cursor-pointer group ${
                        isActive
                          ? "bg-blue-600/10 border-blue-500 text-white shadow-lg shadow-blue-600/5"
                          : "bg-white/[0.01] border-[#1e293b] hover:bg-white/[0.04] hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400 transition-colors"}`} />
                        <span className="font-display font-semibold text-xs md:text-sm tracking-wide text-slate-100 group-hover:text-blue-400 transition-colors">
                          {p.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-sans">{p.description}</p>
                    </button>
                  );
                })}
              </div>

              {/* Modal Footer bar */}
              <div className="p-4 border-t border-[#1e293b]/50 bg-[#070b14] flex justify-end">
                <button
                  onClick={() => setIsGuidelinesOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Close Reference Specs
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

    </div>
  );
}
