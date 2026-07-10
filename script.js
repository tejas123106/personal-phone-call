const APP_PREFIX = 'tejas_chat_v2_';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDcBdpI82SlzkIe4cs3B0uKFPtEBzpWLhs",
  authDomain: "tejas-k-m.firebaseapp.com",
  databaseURL: "https://tejas-k-m-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tejas-k-m",
  storageBucket: "tejas-k-m.firebasestorage.app",
  messagingSenderId: "415563549329",
  appId: "1:415563549329:web:1f24f2e25a10103b9e8d30",
  measurementId: "G-2C3T6X5XJV"
};

// Initialize Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = typeof firebase !== 'undefined' ? firebase.database() : null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const appContainer = document.getElementById('app-container');

const emailInput = document.getElementById('email-input');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const clearDataBtn = document.getElementById('clear-data-btn');
const installBtn = document.getElementById('install-btn');

const myUsernameDisplay = document.getElementById('my-username');
const myAvatar = document.getElementById('my-avatar');
const myAvatarText = document.getElementById('my-avatar-text');
const profilePhotoInput = document.getElementById('profile-photo-input');
const logoutBtn = document.getElementById('logout-btn');

const addFriendInput = document.getElementById('add-friend-input');
const addFriendBtn = document.getElementById('add-friend-btn');
const friendsListUI = document.getElementById('friends-list');

const noChatSelected = document.getElementById('no-chat-selected');
const activeChat = document.getElementById('active-chat');
const backBtn = document.getElementById('back-btn');

const activeFriendName = document.getElementById('active-friend-name');
const activeFriendAvatar = document.getElementById('active-friend-avatar');
const activeFriendAvatarText = document.getElementById('active-friend-avatar-text');
const activeFriendStatus = document.getElementById('active-friend-status');

const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');

const videoContainer = document.getElementById('video-container');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const endCallBtn = document.getElementById('end-call-btn');
const deleteFriendBtn = document.getElementById('delete-friend-btn');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const attachmentBtn = document.getElementById('attachment-btn');
const fileInput = document.getElementById('file-input');

const incomingCallScreen = document.getElementById('incoming-call-screen');
const incomingCallerName = document.getElementById('incoming-caller-name');
const incomingCallType = document.getElementById('incoming-call-type');
const incomingAvatar = document.getElementById('incoming-avatar');
const incomingAvatarText = document.getElementById('incoming-avatar-text');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');
const ringtone = document.getElementById('ringtone');

// App State
let peer;
let myUsername = '';
let myEmail = '';
let myPassword = '';
let myConnectNumber = '';
let friends = []; // Array of "username#code"
let chatHistory = {}; // { "username#code": [ {id, sender, text, msgType, timestamp, status} ] }
let myAvatarData = '';
let friendAvatars = {}; // { "username#code": base64 }

// Utility to generate deterministic 4-digit code
function generateCode(user, pass) {
    let hash = 0;
    const str = user + pass;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; 
    }
    return (Math.abs(hash) % 9000 + 1000).toString();
}

// Hex encoders for safe PeerJS IDs (bypasses special char issues)
function stringToHex(str) {
    let hex = '';
    for(let i=0; i<str.length; i++) {
        let code = str.charCodeAt(i).toString(16);
        hex += (code.length === 1 ? '0' + code : code);
    }
    return hex;
}

function hexToString(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

function getSafePeerId(user, code) {
    return 'pc_' + stringToHex(user.toLowerCase()) + '_' + code;
}

function getFriendIdFromSafeId(safeId) {
    const parts = safeId.split('_');
    if (parts.length !== 3) return safeId;
    return hexToString(parts[1]) + '#' + parts[2];
}

let activeFriend = null;
let activeConnection = null; 
let activeCall = null; 
let localStream = null;
let incomingCallObj = null;

// Connections Map
const connections = {}; 

// Initialize
function init() {
    loadData();
    if (myUsername) {
        startApp(myUsername);
    }
}

function loadData() {
    myUsername = localStorage.getItem('chat_myUsername') || '';
    myEmail = localStorage.getItem('chat_myEmail') || '';
    myPassword = localStorage.getItem('chat_myPassword') || '';
    myConnectNumber = localStorage.getItem('chat_myConnectNumber') || '';
    friends = JSON.parse(localStorage.getItem('chat_friends') || '[]');
    chatHistory = JSON.parse(localStorage.getItem('chat_history') || '{}');
    myAvatarData = localStorage.getItem('chat_myAvatar') || '';
    friendAvatars = JSON.parse(localStorage.getItem('chat_friendAvatars') || '{}');
    
    // Auto-wipe old incompatible formats
    if (friends.length > 0 && !friends[0].includes('#')) {
        friends = [];
        chatHistory = {};
        friendAvatars = {};
    }
}

function saveData() {
    localStorage.setItem('chat_myUsername', myUsername);
    localStorage.setItem('chat_myEmail', myEmail);
    localStorage.setItem('chat_myPassword', myPassword);
    localStorage.setItem('chat_myConnectNumber', myConnectNumber);
    localStorage.setItem('chat_friends', JSON.stringify(friends));
    localStorage.setItem('chat_myAvatar', myAvatarData);
    localStorage.setItem('chat_friendAvatars', JSON.stringify(friendAvatars));
    
    // Convert files to text placeholders before saving
    const safeHistory = {};
    for (let f in chatHistory) {
        safeHistory[f] = chatHistory[f].map(m => {
            if (m.msgType === 'file') {
                return { ...m, text: `[File: ${m.fileName}]`, msgType: 'text', fileBlob: null };
            }
            return m;
        });
    }
    localStorage.setItem('chat_history', JSON.stringify(safeHistory));
}

function generateId() {
    return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    let hours = d.getHours();
    let mins = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    mins = mins < 10 ? '0' + mins : mins;
    return `${hours}:${mins} ${ampm}`;
}

// Login
loginBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const user = usernameInput.value.trim().toLowerCase();
    const pass = passwordInput.value.trim();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError("Please enter a valid email address (e.g., name@gmail.com).");
        return;
    }
    
    const userRegex = /^(?=.*[a-z])(?=.*\d)(?=.*[\W_])[^\s]+$/;
    if (!userRegex.test(user)) {
        showError("Username must include letters, numbers, and a special character (no spaces).");
        return;
    }
    
    if (pass.length < 4) {
        showError("Password must be at least 4 characters long.");
        return;
    }
    
    const savedUser = localStorage.getItem('chat_myUsername');
    if (savedUser && savedUser === user) {
        const savedPass = localStorage.getItem('chat_myPassword');
        if (savedPass && savedPass !== pass) {
            showError("Incorrect password for this username.");
            return;
        }
    }
    
    loginError.classList.add('hidden');
    myEmail = email;
    myPassword = pass;
    myConnectNumber = generateCode(user, pass);
    startApp(user);
});

function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
}

if (clearDataBtn) {
    clearDataBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to delete ALL accounts, friends, and chat history on this device? This cannot be undone.")) {
            localStorage.clear();
            location.reload();
        }
    });
}

function registerUserInDB(username, connectNumber) {
    if (!database) return;
    const safeId = getSafePeerId(username, connectNumber);
    database.ref('users/' + safeId).set({
        username: username,
        connectNumber: connectNumber,
        fullId: `${username}#${connectNumber}`,
        lastOnline: firebase.database.ServerValue.TIMESTAMP
    }).catch(err => console.error("Firebase write error:", err));
}

function startApp(user) {
    myUsername = user;
    saveData();
    
    registerUserInDB(myUsername, myConnectNumber);
    
    myUsernameDisplay.textContent = myUsername;
    updateMyAvatarUI();
    
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    
    renderFriendsList();
    initPeer();
}

function updateMyAvatarUI() {
    if (myAvatarData) {
        myAvatar.style.backgroundImage = `url(${myAvatarData})`;
        myAvatarText.textContent = '';
    } else {
        myAvatar.style.backgroundImage = 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)';
        myAvatarText.textContent = myUsername ? myUsername.charAt(0).toUpperCase() : 'U';
    }
    myUsernameDisplay.textContent = `${myUsername} #${myConnectNumber}`;
}

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('chat_myUsername');
    localStorage.removeItem('chat_myEmail');
    localStorage.removeItem('chat_myPassword');
    localStorage.removeItem('chat_myConnectNumber');
    if (peer) peer.destroy();
    location.reload();
});

// Profile Photo Upload
myAvatar.addEventListener('click', () => profilePhotoInput.click());
profilePhotoInput.addEventListener('change', () => {
    const file = profilePhotoInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 150;
                canvas.width = size; canvas.height = size;
                const ctx = canvas.getContext('2d');
                const minDim = Math.min(img.width, img.height);
                const sx = (img.width - minDim) / 2;
                const sy = (img.height - minDim) / 2;
                ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                
                myAvatarData = canvas.toDataURL('image/jpeg', 0.8);
                saveData();
                updateMyAvatarUI();
                
                Object.values(connections).forEach(conn => {
                    if (conn.open) conn.send({ type: 'avatar', data: myAvatarData });
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// PeerJS Initialization
function initPeer() {
    const safeId = getSafePeerId(myUsername, myConnectNumber);
    peer = new Peer(safeId);

    peer.on('open', (id) => {
        console.log('My safe peer ID is: ' + id);
        if ("Notification" in window) {
            Notification.requestPermission();
        }
    });

    peer.on('connection', (conn) => {
        setupConnection(conn);
    });

    peer.on('call', (call) => {
        if (activeCall) {
            call.close();
            if (connections[call.peer.replace(APP_PREFIX, '')] && connections[call.peer.replace(APP_PREFIX, '')].open) {
                connections[call.peer.replace(APP_PREFIX, '')].send({ type: 'call_rejected' });
            }
            return;
        }
        handleIncomingCall(call);
    });
    peer.on('disconnected', () => {
        console.log("Disconnected from server. Reconnecting...");
        peer.reconnect();
    });

    peer.on('error', (err) => {
        console.error("Peer error:", err);
    });
}

function setupConnection(conn) {
    const friendId = getFriendIdFromSafeId(conn.peer);
    
    connections[friendId] = conn;

    conn.on('open', () => {
        if (!friends.includes(friendId)) {
            friends.unshift(friendId);
            saveData();
            renderFriendsList();
            alert(`Successfully connected with ${friendId}!`);
        }
        
        updateFriendStatus(friendId, true);
        if (myAvatarData) {
            conn.send({ type: 'avatar', data: myAvatarData });
        }
        
        processPendingMessages(friendId);
        
        // If we connect and chat is open, mark messages as read
        if (activeFriend === friendId) {
            markAsRead(friendId);
        }
    });

    conn.on('data', (data) => {
        if (typeof data === 'object') {
            if (data.type === 'avatar') {
                friendAvatars[friendId] = data.data;
                saveData();
                renderFriendsList();
                if (activeFriend === friendId) openChat(friendId); 
            } else if (data.type === 'file') {
                const blob = new Blob([data.file], { type: data.mime });
                handleReceivedMessage(friendId, blob, 'file', data.name, data.id, data.timestamp);
            } else if (data.type === 'text_msg') {
                handleReceivedMessage(friendId, data.text, 'text', null, data.id, data.timestamp);
            } else if (data.type === 'call_cancel') {
                if (incomingCallObj && getFriendIdFromSafeId(incomingCallObj.peer) === friendId) {
                    stopRinging();
                    incomingCallObj.close();
                    incomingCallObj = null;
                    logSystemMessage(friendId, `[❌ Missed Call]`);
                }
            } else if (data.type === 'call_rejected') {
                if (activeCall && activeFriend === friendId) {
                    activeCall.close();
                    endCallUI();
                    logSystemMessage(friendId, `[❌ Call Rejected]`);
                    alert(`${friendId} rejected the call.`);
                }
            } else if (data.type === 'read_receipt') {
                handleReadReceipt(friendId, data.messageIds);
            }
        } else {
            // Legacy support
            handleReceivedMessage(friendId, data, 'text', null, generateId(), Date.now());
        }
    });

    conn.on('close', () => {
        delete connections[friendId];
        updateFriendStatus(friendId, false);
    });
    
    conn.on('error', (err) => {
        console.error("Connection error:", err);
    });
}

function connectToFriend(friendId) {
    if (!peer) return null;
    if (peer.disconnected) peer.reconnect();
    
    if (!connections[friendId] || !connections[friendId].open) {
        try {
            const parts = friendId.split('#');
            if (parts.length !== 2) throw new Error("Invalid format");
            
            const safeFriendId = getSafePeerId(parts[0], parts[1]);
            const conn = peer.connect(safeFriendId);
            setupConnection(conn);
            return conn;
        } catch (e) {
            console.error("Failed to connect:", e);
            return connections[friendId];
        }
    }
    return connections[friendId];
}

function processPendingMessages(friendId) {
    const conn = connections[friendId];
    if (!conn || !conn.open) return;
    
    let updated = false;
    const hist = chatHistory[friendId] || [];
    hist.forEach(msg => {
        if (msg.sender === myUsername && msg.status === 'pending') {
            if (msg.msgType === 'text') {
                conn.send({ type: 'text_msg', id: msg.id, text: msg.text, timestamp: msg.timestamp });
            } else if (msg.msgType === 'file' && msg.fileBlob) {
                // If it's a file and still in memory, send it. If reloaded, fileBlob is lost so it stays pending.
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (conn.open) {
                        conn.send({ type: 'file', id: msg.id, timestamp: msg.timestamp, file: e.target.result, name: msg.fileName, mime: msg.fileBlob.type });
                    }
                };
                reader.readAsArrayBuffer(msg.fileBlob);
            }
            msg.status = 'sent';
            updated = true;
            
            const tickElement = document.getElementById(`tick-${msg.id}`);
            if (tickElement) {
                tickElement.className = 'tick sent';
                tickElement.textContent = '✓';
            }
        }
    });
    if (updated) saveData();
}

// Read Receipts Logic
function markAsRead(friendId) {
    const hist = chatHistory[friendId] || [];
    const unreadIds = [];
    
    hist.forEach(msg => {
        if (msg.sender === friendId && msg.status !== 'read') {
            msg.status = 'read';
            unreadIds.push(msg.id);
        }
    });
    
    if (unreadIds.length > 0) {
        saveData();
        if (connections[friendId] && connections[friendId].open) {
            connections[friendId].send({ type: 'read_receipt', messageIds: unreadIds });
        }
    }
}

function handleReadReceipt(friendId, messageIds) {
    if (!chatHistory[friendId]) return;
    
    let updated = false;
    chatHistory[friendId].forEach(msg => {
        if (messageIds.includes(msg.id)) {
            msg.status = 'read';
            updated = true;
            // Update UI if chat is open
            const tickElement = document.getElementById(`tick-${msg.id}`);
            if (tickElement) {
                tickElement.className = 'tick read';
                tickElement.textContent = '✓✓';
            }
        }
    });
    
    if (updated) saveData();
}

// Friends List UI
addFriendBtn.addEventListener('click', () => {
    const friendId = addFriendInput.value.trim().toLowerCase();
    if (!friendId || !friendId.includes('#')) {
        alert("Please enter the exact Username and Connect Number (e.g. tejas@123#4582)");
        return;
    }
    
    const myFullId = `${myUsername}#${myConnectNumber}`.toLowerCase();
    if (friendId === myFullId) {
        alert("You cannot add yourself.");
        return;
    }
    
    if (friends.includes(friendId)) {
        alert("Friend is already in your list.");
        addFriendInput.value = '';
        openChat(friendId);
        return;
    }
    
    addFriendBtn.textContent = 'Searching...';
    addFriendBtn.disabled = true;
    
    const parts = friendId.split('#');
    const safeFriendId = getSafePeerId(parts[0], parts[1]);
    
    if (database) {
        // Use Global Database to instantly check if they exist
        database.ref('users/' + safeFriendId).once('value').then((snapshot) => {
            if (snapshot.exists()) {
                if (!friends.includes(friendId)) {
                    friends.unshift(friendId);
                    saveData();
                    renderFriendsList();
                    alert(`Successfully found and added ${friendId}!`);
                }
                addFriendInput.value = '';
                openChat(friendId);
            } else {
                alert("Could not find this user in the global database. Check the spelling and connect number.");
            }
            addFriendBtn.textContent = 'Add Friend';
            addFriendBtn.disabled = false;
        }).catch(err => {
            console.error("DB Error:", err);
            fallbackLocalSearch(friendId);
        });
    } else {
        fallbackLocalSearch(friendId);
    }
});

function fallbackLocalSearch(friendId) {
    const conn = connectToFriend(friendId);
    
    setTimeout(() => {
        addFriendBtn.textContent = 'Add Friend';
        addFriendBtn.disabled = false;
        
        if (!friends.includes(friendId)) {
            alert("Database offline: Could not find this user. Please ensure they are currently ONLINE.");
            if (connections[friendId]) {
                connections[friendId].close();
                delete connections[friendId];
            }
        } else {
            addFriendInput.value = '';
            openChat(friendId);
        }
    }, 5000);
}

function renderFriendsList() {
    friendsListUI.innerHTML = '';
    friends.forEach(f => {
        const li = document.createElement('li');
        li.className = `friend-item ${activeFriend === f ? 'active' : ''}`;
        
        const hist = chatHistory[f] || [];
        const lastMsgObj = hist.length > 0 ? hist[hist.length-1] : null;
        let lastMsg = 'No messages yet';
        
        if (lastMsgObj) {
            if (lastMsgObj.msgType === 'system') lastMsg = lastMsgObj.text;
            else if (lastMsgObj.msgType === 'file') lastMsg = '📄 File';
            else lastMsg = lastMsgObj.text;
            
            // Add ticks to last message preview if we sent it
            if (lastMsgObj.sender === myUsername && lastMsgObj.msgType !== 'system') {
                const tick = lastMsgObj.status === 'read' ? '✓✓ ' : '✓ ';
                lastMsg = tick + lastMsg;
            }
        }
        
        const fAvatar = friendAvatars[f];
        const avatarHtml = fAvatar 
            ? `<div class="avatar" style="background-image: url(${fAvatar})"></div>`
            : `<div class="avatar">${f.charAt(0).toUpperCase()}</div>`;

        li.innerHTML = `
            ${avatarHtml}
            <div class="info">
                <h4>${f}</h4>
                <p>${lastMsg}</p>
            </div>
            <div class="status-dot ${connections[f] && connections[f].open ? 'online' : ''}" id="status-dot-${f}"></div>
        `;
        li.onclick = () => openChat(f);
        friendsListUI.appendChild(li);
    });
}

function updateFriendStatus(friendId, isOnline) {
    const dot = document.getElementById(`status-dot-${friendId}`);
    if (dot) dot.className = `status-dot ${isOnline ? 'online' : ''}`;
    
    if (activeFriend === friendId) {
        activeFriendStatus.textContent = isOnline ? 'Online' : 'Offline';
        activeFriendStatus.className = isOnline ? 'status-online' : 'status-offline';
    }
}

// Chat UI
function openChat(friendId) {
    activeFriend = friendId;
    activeConnection = connectToFriend(friendId);
    
    noChatSelected.classList.add('hidden');
    activeChat.classList.remove('hidden');
    appContainer.classList.add('in-chat');
    
    activeFriendName.textContent = friendId;
    
    if (friendAvatars[friendId]) {
        activeFriendAvatar.style.backgroundImage = `url(${friendAvatars[friendId]})`;
        activeFriendAvatarText.textContent = '';
    } else {
        activeFriendAvatar.style.backgroundImage = 'none';
        activeFriendAvatarText.textContent = friendId.charAt(0).toUpperCase();
    }
    
    updateFriendStatus(friendId, connections[friendId] && connections[friendId].open);
    
    markAsRead(friendId);
    
    renderChatMessages();
    renderFriendsList();
}

backBtn.addEventListener('click', () => {
    appContainer.classList.remove('in-chat');
    activeFriend = null;
    activeChat.classList.add('hidden');
    noChatSelected.classList.remove('hidden');
    renderFriendsList();
});

deleteFriendBtn.addEventListener('click', () => {
    if (!activeFriend) return;
    
    if (confirm(`Are you sure you want to delete ${activeFriend} and all their chat history?`)) {
        friends = friends.filter(f => f !== activeFriend);
        delete chatHistory[activeFriend];
        delete friendAvatars[activeFriend];
        
        if (connections[activeFriend]) {
            connections[activeFriend].close();
            delete connections[activeFriend];
        }
        
        saveData();
        
        appContainer.classList.remove('in-chat');
        activeFriend = null;
        activeChat.classList.add('hidden');
        noChatSelected.classList.remove('hidden');
        renderFriendsList();
    }
});

function renderChatMessages() {
    chatMessages.innerHTML = '';
    const hist = chatHistory[activeFriend] || [];
    hist.forEach(msg => {
        appendMessageUI(msg);
    });
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMessageUI(msg) {
    const div = document.createElement('div');
    div.className = `message ${msg.sender === myUsername ? 'sent' : 'received'}`;
    
    let contentHtml = '';
    
    if (msg.msgType === 'system') {
        div.className = 'message system';
        contentHtml = `<span>${msg.text}</span>`;
    } else if (msg.msgType === 'file') {
        div.classList.add('file-message');
        const url = msg.fileBlob ? URL.createObjectURL(msg.fileBlob) : '#';
        contentHtml = `
            <a href="${url}" ${msg.fileBlob ? `download="${msg.fileName}"` : ''} class="file-link">
                <span class="file-icon">📄</span>
                <span>${msg.fileName || msg.text}</span>
            </a>
        `;
    } else {
        contentHtml = `<div class="message-content">${msg.text}</div>`;
    }
    
    // Add meta info (time and ticks) for non-system messages
    if (msg.msgType !== 'system') {
        const timeStr = formatTime(msg.timestamp);
        let tickHtml = '';
        if (msg.sender === myUsername) {
            let tickClass = 'sent';
            let tickChar = '✓';
            if (msg.status === 'read') {
                tickClass = 'read';
                tickChar = '✓✓';
            } else if (msg.status === 'pending') {
                tickClass = 'pending';
                tickChar = '🕒';
            }
            tickHtml = `<span class="tick ${tickClass}" id="tick-${msg.id}">${tickChar}</span>`;
        }
        
        contentHtml += `
            <div class="message-meta">
                <span class="time">${timeStr}</span>
                ${tickHtml}
            </div>
        `;
    }
    
    div.innerHTML = contentHtml;
    chatMessages.appendChild(div);
}

function logSystemMessage(friendId, text) {
    const msgObj = { id: generateId(), sender: myUsername, text: text, msgType: 'system', timestamp: Date.now() };
    saveMessageToHistory(friendId, msgObj);
    if (activeFriend === friendId) {
        appendMessageUI(msgObj);
        scrollToBottom();
    }
    renderFriendsList();
}

// Sending Messages
sendBtn.addEventListener('click', sendTextMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendTextMessage();
});

function sendTextMessage() {
    const text = chatInput.value.trim();
    if (!text || !activeFriend) return;

    const msgId = generateId();
    const timestamp = Date.now();
    
    const packet = {
        type: 'text_msg',
        id: msgId,
        text: text,
        timestamp: timestamp
    };
    
    const conn = connectToFriend(activeFriend);
    let initialStatus = 'pending';
    
    if (conn.open) {
        conn.send(packet);
        initialStatus = 'sent';
    }
    
    const msgObj = { id: msgId, sender: myUsername, text: text, msgType: 'text', timestamp: timestamp, status: initialStatus };
    saveMessageToHistory(activeFriend, msgObj);
    appendMessageUI(msgObj);
    scrollToBottom();
    
    chatInput.value = '';
    renderFriendsList();
}

function handleReceivedMessage(friendId, data, msgType, fileName, id, timestamp) {
    let msgObj;
    if (msgType === 'file') {
        msgObj = { id: id, sender: friendId, text: `[File: ${fileName}]`, msgType: 'file', fileBlob: data, fileName: fileName, timestamp: timestamp, status: 'received' };
    } else {
        msgObj = { id: id, sender: friendId, text: data, msgType: 'text', timestamp: timestamp, status: 'received' };
    }
    
    saveMessageToHistory(friendId, msgObj);
    
    if (activeFriend === friendId) {
        appendMessageUI(msgObj);
        scrollToBottom();
        markAsRead(friendId);
    }
    
    friends = friends.filter(f => f !== friendId);
    friends.unshift(friendId);
    saveData();
    renderFriendsList();
}

function saveMessageToHistory(friendId, msgObj) {
    if (!chatHistory[friendId]) chatHistory[friendId] = [];
    chatHistory[friendId].push(msgObj);
    saveData();
}

// Attachments
attachmentBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file || !activeFriend) return;
    
    if (file.size > 50 * 1024 * 1024) {
        alert("File too large. Limit is 50MB.");
        fileInput.value = '';
        return;
    }

    const conn = connectToFriend(activeFriend);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const msgId = generateId();
        const timestamp = Date.now();
        let initialStatus = 'pending';
        
        if (conn.open) {
            conn.send({ type: 'file', id: msgId, timestamp: timestamp, file: e.target.result, name: file.name, mime: file.type });
            initialStatus = 'sent';
        }
        
        const blob = new Blob([e.target.result], { type: file.type });
        const msgObj = { id: msgId, sender: myUsername, text: `[File: ${file.name}]`, msgType: 'file', fileBlob: blob, fileName: file.name, timestamp: timestamp, status: initialStatus };
        
        saveMessageToHistory(activeFriend, msgObj);
        appendMessageUI(msgObj);
        scrollToBottom();
        
        fileInput.value = '';
        renderFriendsList();
    };
    reader.readAsArrayBuffer(file);
});

// Call Logic
voiceCallBtn.addEventListener('click', () => initiateCall('voice'));
videoCallBtn.addEventListener('click', () => initiateCall('video'));

function initiateCall(type) {
    if (!activeFriend) return;
    
    const conn = connections[activeFriend];
    if (!conn || !conn.open) {
        alert("This user is currently unreachable or offline. Please wait for them to come online.");
        return;
    }
    
    const isVoice = type === 'voice';
    navigator.mediaDevices.getUserMedia({ video: !isVoice, audio: true })
        .then((stream) => {
            localStream = stream;
            localVideo.srcObject = stream;
            
            const call = peer.call(APP_PREFIX + activeFriend, stream, { metadata: { type: type, caller: myUsername } });
            setupCallUI(call, isVoice);
            
            logSystemMessage(activeFriend, `[📞 Outgoing ${isVoice ? 'Voice' : 'Video'} Call]`);
        })
        .catch(err => {
            alert('Could not access Camera/Microphone.');
        });
}

function handleIncomingCall(call) {
    incomingCallObj = call;
    const isVoice = call.metadata && call.metadata.type === 'voice';
    const callerName = call.metadata ? call.metadata.caller : call.peer.replace(APP_PREFIX, '');
    
    incomingCallerName.textContent = callerName;
    incomingCallType.textContent = isVoice ? "Incoming voice call..." : "Incoming video call...";
    
    if (friendAvatars[callerName]) {
        incomingAvatar.style.backgroundImage = `url(${friendAvatars[callerName]})`;
        incomingAvatarText.textContent = '';
    } else {
        incomingAvatar.style.backgroundImage = 'none';
        incomingAvatarText.textContent = callerName.charAt(0).toUpperCase();
    }
    
    incomingCallScreen.classList.remove('hidden');
    ringtone.play().catch(e => console.log("Audio play blocked by browser."));
    
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`Incoming call from ${callerName}`);
    }
}

acceptCallBtn.addEventListener('click', () => {
    stopRinging();
    if (!incomingCallObj) return;
    
    const call = incomingCallObj;
    incomingCallObj = null;
    const isVoice = call.metadata && call.metadata.type === 'voice';

    const callerName = call.metadata ? call.metadata.caller : call.peer.replace(APP_PREFIX, '');
    if (!friends.includes(callerName)) {
        friends.unshift(callerName);
        saveData();
    }
    openChat(callerName);
    
    logSystemMessage(callerName, `[📞 Answered Call]`);

    navigator.mediaDevices.getUserMedia({ video: !isVoice, audio: true })
        .then((stream) => {
            localStream = stream;
            localVideo.srcObject = stream;
            call.answer(stream);
            setupCallUI(call, isVoice);
        })
        .catch(err => {
            call.close();
        });
});

rejectCallBtn.addEventListener('click', () => {
    stopRinging();
    if (incomingCallObj) {
        const callerName = incomingCallObj.metadata ? incomingCallObj.metadata.caller : incomingCallObj.peer.replace(APP_PREFIX, '');
        if (connections[callerName] && connections[callerName].open) {
            connections[callerName].send({ type: 'call_rejected' });
        }
        incomingCallObj.close();
        incomingCallObj = null;
        logSystemMessage(callerName, `[❌ Rejected Call]`);
    }
});

function stopRinging() {
    incomingCallScreen.classList.add('hidden');
    ringtone.pause();
    ringtone.currentTime = 0;
}

function setupCallUI(call, isVoiceOnly) {
    activeCall = call;
    videoContainer.classList.remove('hidden');
    
    if (isVoiceOnly) {
        remoteVideo.classList.add('audio-only');
        localVideo.classList.add('audio-only');
    } else {
        remoteVideo.classList.remove('audio-only');
        localVideo.classList.remove('audio-only');
    }

    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
    });

    call.on('close', () => {
        endCallUI();
    });
}

endCallBtn.addEventListener('click', () => {
    if (activeCall) {
        activeCall.close();
        if (activeFriend && connections[activeFriend] && connections[activeFriend].open) {
            connections[activeFriend].send({ type: 'call_cancel' });
        }
    }
    endCallUI();
    if (activeFriend) {
        logSystemMessage(activeFriend, `[📞 Call Ended]`);
    }
});

function endCallUI() {
    if (activeCall) activeCall = null;
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    videoContainer.classList.add('hidden');
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
}

init();

// Register Service Worker for PWA Support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('Service Worker registered successfully!', reg);
        }).catch(err => {
            console.error('Service Worker registration failed:', err);
        });
    });
}

// PWA Install Prompt Logic
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
        installBtn.classList.remove('hidden');
    }
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                installBtn.classList.add('hidden');
            }
            deferredPrompt = null;
        }
    });
}
