import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Supabase
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// State
let currentUser = null;
let currentConversation = null;

// Screens
const loginScreen = document.getElementById('login-screen');
const chatListScreen = document.getElementById('chat-list-screen');
const chatScreen = document.getElementById('chat-screen');

// Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnSignIn = document.getElementById('btn-signin');
const btnLogout = document.getElementById('btn-logout');
const convList = document.getElementById('conversations');
const messagesList = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');
const btnBack = document.getElementById('btn-back');
const chatTitle = document.getElementById('chat-title');

// Helpers
function show(screen) {
  [loginScreen, chatListScreen, chatScreen].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

// Auth
btnSignIn.onclick = async () => {
  const { user, error } = await supabase.auth.signIn({
    email: emailInput.value,
    password: passwordInput.value
  });
  if (error) return alert(error.message);
  currentUser = user;
  loadConversations();
};

btnLogout.onclick = async () => {
  await supabase.auth.signOut();
  currentUser = null;
  show(loginScreen);
};

// Load conversations
async function loadConversations() {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return console.error(error);
  convList.innerHTML = '';
  data.forEach(conv => {
    const li = document.createElement('li');
    li.textContent = `Conversation ${conv.id}`;
    li.onclick = () => openConversation(conv.id);
    convList.append(li);
  });
  show(chatListScreen);
}

// Open a chat
async function openConversation(convId) {
  currentConversation = convId;
  chatTitle.textContent = `Chat ${convId}`;

  // Load history
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', convId)
    .order('inserted_at', { ascending: true });
  renderMessages(messages);

  // Subscribe
  supabase
    .channel(`messages:conversation=${convId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` }, payload => {
      renderMessage(payload.new);
    })
    .subscribe();

  show(chatScreen);
}

// Render
function renderMessages(msgs) {
  messagesList.innerHTML = '';
  msgs.forEach(renderMessage);
}

function renderMessage(msg) {
  const li = document.createElement('li');
  li.textContent = msg.content;
  li.classList.add(msg.sender_id === currentUser.id ? 'self' : 'other');
  messagesList.append(li);
  messagesList.scrollTop = messagesList.scrollHeight;
}

// Send message
btnSend.onclick = async () => {
  const content = messageInput.value.trim();
  if (!content) return;
  await supabase.from('messages').insert([{ conversation_id: currentConversation, sender_id: currentUser.id, content }]);
  messageInput.value = '';
};

// Back
btnBack.onclick = () => show(chatListScreen);

// On load
supabase.auth.onAuthStateChange((_, session) => {
  if (session?.user) {
    currentUser = session.user;
    loadConversations();
  } else show(loginScreen);
});
