export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  groundingSources?: { title?: string; uri?: string }[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  systemInstruction: string;
  model: string;
  temperature: number;
  createdAt: string;
}

export interface Preset {
  id: string;
  title: string;
  description: string;
  prompt: string;
}
