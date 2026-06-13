// Zalo Chat Framework Frontend Handler

// Global States
let connection = null;
let currentRoomId = "general";
let selectedFile = null;
let uploadAbortController = null;
let isTyping = false;
let typingTimeout = null;
let sessionMessages = [];
let serverBaseUrl = window.location.origin; // Tracks current connected server

// DOM Elements
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");
const emojiGrid = document.getElementById("emojiGrid");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const senderNameInput = document.getElementById("senderName");
const statusDot = document.querySelector(".status-dot");
const statusText = document.getElementById("statusText");
const connectionBanner = document.getElementById("connectionBanner");
const typingIndicator = document.getElementById("typingIndicator");
const typingUser = document.getElementById("typingUser");
const uploadProgressArea = document.getElementById("uploadProgressArea");
const uploadFileName = document.getElementById("uploadFileName");
const uploadPercent = document.getElementById("uploadPercent");
const uploadProgressBar = document.getElementById("uploadProgressBar");
const uploadSpeed = document.getElementById("uploadSpeed");
const uploadRemaining = document.getElementById("uploadRemaining");
const attachmentPreviewPane = document.getElementById("attachmentPreviewPane");
const previewThumbnail = document.getElementById("previewThumbnail");
const previewFileName = document.getElementById("previewFileName");
const previewFileSize = document.getElementById("previewFileSize");
const cancelPreviewBtn = document.getElementById("cancelPreviewBtn");
const detailsPanel = document.getElementById("detailsPanel");
const toggleDetailsBtn = document.getElementById("toggleDetailsBtn");
const closeDetailsBtn = document.getElementById("closeDetailsBtn");
const sharedImagesGrid = document.getElementById("sharedImagesGrid");
const sharedFilesList = document.getElementById("sharedFilesList");
const activeRoomName = document.getElementById("activeRoomName");
const activeRoomAvatar = document.getElementById("activeRoomAvatar");

// Emojis list
const emojiList = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
    "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
    "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
    "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
    "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬",
    "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗",
    "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯",
    "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷",
    "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩",
    "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹",
    "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉",
    "👆", "🖕", "👇", "☝️", "✋", "🤚", "🖐", "🖖", "👋", "✍️",
    "👏", "👐", "🙌", "🤲", "🙏", "🤝", "💅", "🤳", "💪", "🦾",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔"
];

// Initialize application on DOM content loaded
document.addEventListener("DOMContentLoaded", () => {
    // Parse Room ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomId = urlParams.get("roomId");
    if (urlRoomId) {
        currentRoomId = urlRoomId;
    }

    // Set initial IP input value
    const ipInput = document.getElementById("serverIpInput");
    if (ipInput) {
        ipInput.value = window.location.host;
    }

    setupSignalR();
    setupEventListeners();
    loadEmojiPicker();
    loadRoomMessages(currentRoomId);
    setupTheme();
});

// Theme toggle logic (Light/Dark)
function setupTheme() {
    const themeToggle = document.getElementById("themeToggle");
    const currentTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", currentTheme);

    themeToggle.addEventListener("click", () => {
        const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    });
}

// -------------------------------------------------------------
// SIGNALR FLOW & LOGIC (Assigned to Member 2)
// -------------------------------------------------------------
function setupSignalR() {
    // If a connection already exists, make sure to stop it
    if (connection) {
        connection.stop();
    }

    connection = new signalR.HubConnectionBuilder()
        .withUrl(serverBaseUrl + "/chatHub")
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // Custom intervals
        .build();

    // Event: Connection state changes
    connection.onreconnecting(() => {
        statusDot.className = "status-dot disconnected";
        statusText.innerText = "Đang kết nối lại...";
        connectionBanner.classList.remove("hidden");
    });

    connection.onreconnected(() => {
        statusDot.className = "status-dot connected";
        statusText.innerText = "Trực tuyến";
        connectionBanner.classList.add("hidden");
        // Re-join current chat room on reconnect
        connection.invoke("JoinRoom", currentRoomId).catch(console.error);
    });

    connection.onclose(() => {
        statusDot.className = "status-dot disconnected";
        statusText.innerText = "Mất kết nối";
        connectionBanner.classList.remove("hidden");
        connectionBanner.innerText = "Mất kết nối với máy chủ. Vui lòng F5 để tải lại trang.";
    });

    // Event: Receive message in room
    connection.on("ReceiveMessage", (msg) => {
        appendMessageToUI(msg);
        updateRoomLastMessage(msg);
        if (msg.fileUrl) {
            sessionMessages.push(msg);
            updateSharedFilesDrawer(sessionMessages);
        }
    });

    // Event: Typing indicator update
    connection.on("ReceiveTyping", (sender, typingState) => {
        if (typingState) {
            typingUser.innerText = sender;
            typingIndicator.classList.remove("hidden");
        } else {
            typingIndicator.classList.add("hidden");
        }
    });

    // Start connection
    connection.start()
        .then(() => {
            statusDot.className = "status-dot connected";
            statusText.innerText = "Trực tuyến";
            // Join active room
            connection.invoke("JoinRoom", currentRoomId)
                .then(() => console.log(`Joined room group: ${currentRoomId}`))
                .catch(console.error);
        })
        .catch(err => {
            console.error("SignalR Connection Error: ", err);
            statusDot.className = "status-dot disconnected";
            statusText.innerText = "Lỗi kết nối";
        });
}

// -------------------------------------------------------------
// EVENT LISTENERS SETUP
// -------------------------------------------------------------
function setupEventListeners() {
    // Send message on button click
    sendBtn.addEventListener("click", () => {
        sendMessage();
    });

    // Send message on Enter keypress
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Monitor typing state to notify others
    messageInput.addEventListener("input", () => {
        handleTypingState();
    });

    // Toggle Emoji Picker visibility
    emojiBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        emojiPicker.classList.toggle("hidden");
    });

    // Hide emoji picker when clicking elsewhere
    document.addEventListener("click", (e) => {
        if (!emojiPicker.classList.contains("hidden") && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.classList.add("hidden");
        }
    });

    // Attach File selection
    attachBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    cancelPreviewBtn.addEventListener("click", () => {
        clearFileSelection();
    });

    // Sidebar details toggle
    toggleDetailsBtn.addEventListener("click", () => {
        detailsPanel.classList.toggle("hidden");
    });

    closeDetailsBtn.addEventListener("click", () => {
        detailsPanel.classList.add("hidden");
    });

    // Lightbox image close
    const lightboxModal = document.getElementById("lightboxModal");
    document.getElementById("lightboxClose").addEventListener("click", () => {
        lightboxModal.classList.add("hidden");
    });
    lightboxModal.addEventListener("click", (e) => {
        if (e.target === lightboxModal) {
            lightboxModal.classList.add("hidden");
        }
    });

    // Connect to external server IP button
    const connectServerBtn = document.getElementById("connectServerBtn");
    const serverIpInput = document.getElementById("serverIpInput");
    if (connectServerBtn && serverIpInput) {
        connectServerBtn.addEventListener("click", () => {
            const enteredVal = serverIpInput.value.trim();
            if (enteredVal === "") {
                alert("Vui lòng nhập địa chỉ IP:Port hợp lệ!");
                return;
            }

            let tempHost = enteredVal.replace("http://", "").replace("https://", "");
            if (!tempHost.includes(":")) {
                tempHost = tempHost + ":5000";
            }

            serverBaseUrl = "http://" + tempHost;
            
            chatMessages.innerHTML = `
                <div class="chat-feed-loader" style="animation: none;">
                    <p style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">
                        Đang kết nối tới máy chủ: ${serverBaseUrl}...
                    </p>
                </div>
            `;

            setupSignalR();
        });
    }
}

// Send Typing Event to SignalR (Throttled)
function handleTypingState() {
    if (!isTyping) {
        isTyping = true;
        const sender = senderNameInput.value || "AnonymousUser";
        connection.invoke("SendTyping", currentRoomId, sender, true).catch(console.error);
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTyping = false;
        const sender = senderNameInput.value || "AnonymousUser";
        connection.invoke("SendTyping", currentRoomId, sender, false).catch(console.error);
    }, 2000); // Stop typing after 2 seconds of inactivity
}

// -------------------------------------------------------------
// UI RENDERING & MESSAGE HISTORY
// -------------------------------------------------------------
function loadRoomMessages(roomId) {
    chatMessages.innerHTML = `
        <div class="chat-feed-loader" style="animation: none;">
        </div>
    `;

    const activeRoomElement = document.querySelector(`.room-item[data-room-id="${roomId}"]`);
    if (activeRoomElement) {
        activeRoomName.innerText = activeRoomElement.querySelector(".room-name").innerText;
        activeRoomAvatar.innerText = activeRoomElement.querySelector(".room-avatar").innerText;
    }

    scrollToBottom();
    sessionMessages = [];
    updateSharedFilesDrawer([]);
}

function appendMessageToUI(msg) {
    const sender = senderNameInput.value || "AnonymousUser";
    const isMe = msg.sender === sender;

    const row = document.createElement("div");
    row.className = `msg-row ${isMe ? "sent" : "received"}`;
    row.id = `msg-${msg.id}`;

    // Meta details (Sender, Time)
    const meta = document.createElement("div");
    meta.className = "msg-meta";
    const localTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    meta.innerText = `${isMe ? "" : msg.sender + " • "}${localTime}`;

    // Bubble content
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    if (msg.fileUrl) {
        // Render File Attachment
        if (msg.fileType === "image") {
            let fullFileUrl = msg.fileUrl;
            if (fullFileUrl.startsWith("/")) {
                fullFileUrl = serverBaseUrl + fullFileUrl;
            }

            const imgLink = document.createElement("a");
            imgLink.className = "msg-image-attachment";
            imgLink.onclick = () => showLightbox(fullFileUrl, msg.fileName);
            
            const img = document.createElement("img");
            img.src = fullFileUrl;
            img.alt = msg.fileName;
            
            imgLink.appendChild(img);
            bubble.appendChild(imgLink);
        } else {
            // Render Document/Archive File Card
            const fileCard = document.createElement("div");
            fileCard.className = "msg-file-attachment";

            const ext = msg.fileName.split('.').pop().toUpperCase();
            fileCard.innerHTML = `
                <div class="file-icon-box">${ext}</div>
                <div class="file-info-box">
                    <span class="file-name-text" title="${msg.fileName}">${msg.fileName}</span>
                    <span class="file-size-text">${formatBytes(msg.fileSize)}</span>
                </div>
                <button class="download-action-btn" onclick="downloadFileWithProgress('${msg.fileName}', ${msg.fileSize}, ${msg.id})">
                    <svg viewBox="0 0 24 24" class="svg-icon" style="width:16px;height:16px;fill:#fff;"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                    Tải về
                </button>
            `;
            
            // Progress Bar Container for Downloading (Filled dynamically)
            const downloadProgressContainer = document.createElement("div");
            downloadProgressContainer.className = "bubble-download-progress hidden";
            downloadProgressContainer.id = `download-bar-${msg.id}`;
            downloadProgressContainer.innerHTML = `<div class="bubble-download-fill" id="download-fill-${msg.id}"></div>`;
            
            fileCard.appendChild(downloadProgressContainer);
            bubble.appendChild(fileCard);
        }
    } else {
        // Plain text bubble
        bubble.innerText = msg.content;
    }

    row.appendChild(meta);
    row.appendChild(bubble);
    
    // Remove loader or placeholder if present
    const loader = chatMessages.querySelector(".chat-feed-loader");
    if (loader) loader.remove();

    chatMessages.appendChild(row);
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateRoomLastMessage(msg) {
    const lastMsgBox = document.getElementById(`last-msg-${msg.ChatRoomId || msg.chatRoomId || currentRoomId}`);
    if (lastMsgBox) {
        lastMsgBox.innerText = msg.fileUrl ? `[Tệp đính kèm: ${msg.fileName}]` : msg.content;
    }
}

// Lightbox for visual preview clicks
function showLightbox(src, name) {
    const lightboxModal = document.getElementById("lightboxModal");
    const lightboxImage = document.getElementById("lightboxImage");
    const lightboxCaption = document.getElementById("lightboxCaption");

    lightboxImage.src = src;
    lightboxCaption.innerText = name;
    lightboxModal.classList.remove("hidden");
}

// -------------------------------------------------------------
// EMOJI PICKER BINDINGS (Assigned to Member 1)
// -------------------------------------------------------------
function loadEmojiPicker() {
    emojiGrid.innerHTML = "";
    emojiList.forEach(emoji => {
        const span = document.createElement("span");
        span.className = "emoji-item";
        span.innerText = emoji;
        span.addEventListener("click", () => {
            messageInput.value += emoji;
            messageInput.focus();
            emojiPicker.classList.add("hidden");
            handleTypingState(); // Trigger typing status update
        });
        emojiGrid.appendChild(span);
    });
}

// -------------------------------------------------------------
// LOCAL FILE ATTACHMENT PREVIEW (Assigned to Member 4)
// -------------------------------------------------------------
function handleFileSelection(file) {
    selectedFile = file;

    // Display File Meta details
    previewFileName.innerText = file.name;
    previewFileSize.innerText = formatBytes(file.size);

    // Determine type
    const isImage = file.type.startsWith("image/");
    previewThumbnail.innerHTML = "";

    if (isImage) {
        // Setup direct temporary review object URL
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(img.src); // Free memory once loaded in thumbnail
        };
        previewThumbnail.appendChild(img);
    } else {
        // Doc file visual indicator
        const span = document.createElement("span");
        span.style.fontSize = "24px";
        span.style.fontWeight = "bold";
        span.innerText = file.name.split('.').pop().toUpperCase();
        previewThumbnail.appendChild(span);
    }

    attachmentPreviewPane.classList.remove("hidden");
}

function clearFileSelection() {
    selectedFile = null;
    fileInput.value = "";
    attachmentPreviewPane.classList.add("hidden");
}

// -------------------------------------------------------------
// CHUNKED UPLOAD LOGIC (>1GB SUPPORT) (Assigned to Member 3)
// -------------------------------------------------------------
async function sendMessage() {
    const sender = senderNameInput.value || "AnonymousUser";
    const textContent = messageInput.value.trim();

    // If file is attached, run chunk upload first
    if (selectedFile) {
        const fileToUpload = selectedFile;
        clearFileSelection(); // Hide selection window
        
        try {
            const uploadResult = await uploadFileInChunks(fileToUpload);
            if (uploadResult && uploadResult.success) {
                // Call SignalR Hub sending file metadata
                await connection.invoke("SendMessage", 
                    currentRoomId, 
                    sender, 
                    `Đã chia sẻ tệp: ${uploadResult.fileName}`, 
                    uploadResult.fileUrl, 
                    uploadResult.fileName, 
                    uploadResult.fileType, 
                    uploadResult.fileSize
                );
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("Tải file lên thất bại. Vui lòng kiểm tra dung lượng kết nối hoặc thử lại.");
        }
        return;
    }

    // Normal message flow
    if (textContent === "") return;
    messageInput.value = "";
    messageInput.focus();

    connection.invoke("SendMessage", currentRoomId, sender, textContent, null, null, null, null)
        .catch(err => console.error("Error sending message via SignalR:", err));
}

// Slice-based chunk file uploader
function uploadFileInChunks(file) {
    return new Promise((resolve, reject) => {
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB Chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let currentChunkIndex = 0;
        let bytesUploaded = 0;
        let startTime = Date.now();

        // Show progress panel
        uploadProgressArea.classList.remove("hidden");
        uploadFileName.innerText = file.name;
        uploadPercent.innerText = "0%";
        uploadProgressBar.style.width = "0%";

        uploadAbortController = new AbortController();

        async function uploadNextChunk() {
            if (currentChunkIndex >= totalChunks) {
                // Completed!
                uploadProgressArea.classList.add("hidden");
                resolve();
                return;
            }

            const start = currentChunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append("chunk", chunk);
            formData.append("fileId", fileId);
            formData.append("chunkIndex", currentChunkIndex);
            formData.append("totalChunks", totalChunks);
            formData.append("fileName", file.name);

            try {
                // Upload chunk to Razor Page Handler
                const response = await fetch(serverBaseUrl + "/Index?handler=UploadChunk", {
                    method: "POST",
                    body: formData,
                    signal: uploadAbortController.signal
                });

                if (!response.ok) {
                    throw new Error(`Server returned HTTP ${response.status}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    bytesUploaded += (end - start);
                    currentChunkIndex++;
                    
                    // Calculate and render speed metrics
                    const elapsedSeconds = (Date.now() - startTime) / 1000;
                    const speedBps = bytesUploaded / (elapsedSeconds || 1);
                    const speedFormatted = speedBps > 1024 * 1024 
                        ? `${(speedBps / (1024 * 1024)).toFixed(1)} MB/s` 
                        : `${(speedBps / 1024).toFixed(1)} KB/s`;

                    const percentage = Math.round((bytesUploaded / file.size) * 100);
                    const remainingBytes = file.size - bytesUploaded;
                    const etaSeconds = Math.round(remainingBytes / (speedBps || 1));
                    const etaFormatted = etaSeconds > 60 
                        ? `${Math.floor(etaSeconds / 60)}p ${etaSeconds % 60}s` 
                        : `${etaSeconds} giây`;

                    // Update UI Progress
                    uploadPercent.innerText = `${percentage}%`;
                    uploadProgressBar.style.width = `${percentage}%`;
                    uploadSpeed.innerText = speedFormatted;
                    uploadRemaining.innerText = `Còn lại: ${etaFormatted}`;

                    if (result.fileUrl) {
                        // Merging completed on server!
                        uploadProgressArea.classList.add("hidden");
                        resolve(result);
                        return;
                    }

                    // Recursively upload next chunk
                    await uploadNextChunk();
                } else {
                    reject(new Error("Server failed to accept chunk payload"));
                }
            } catch (error) {
                uploadProgressArea.classList.add("hidden");
                reject(error);
            }
        }

        uploadNextChunk();
    });
}

// -------------------------------------------------------------
// CUSTOM DOWNLOAD WITH PROGRESS (ReadableStream) (Assigned to Member 4)
// -------------------------------------------------------------
async function downloadFileWithProgress(fileName, fileSize, msgId) {
    const downloadBar = document.getElementById(`download-bar-${msgId}`);
    const downloadFill = document.getElementById(`download-fill-${msgId}`);

    if (downloadBar) downloadBar.classList.remove("hidden");
    if (downloadFill) downloadFill.style.width = "0%";

    try {
        const response = await fetch(serverBaseUrl + `/Index?handler=DownloadFile&fileName=${encodeURIComponent(fileName)}`);
        
        if (!response.ok) {
            throw new Error(`File download failed: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        
        // Use total length from response headers, fallback to DB metadata if needed
        const totalBytes = Number(response.headers.get('content-length')) || fileSize;
        let receivedBytes = 0;
        const chunks = [];

        while(true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            chunks.push(value);
            receivedBytes += value.length;

            if (totalBytes > 0) {
                const percent = Math.round((receivedBytes / totalBytes) * 100);
                if (downloadFill) downloadFill.style.width = `${percent}%`;
            }
        }

        // Assemble chunks into final Client file download triggers
        const blob = new Blob(chunks);
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup memory
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        // Hide progress visual bar
        setTimeout(() => {
            if (downloadBar) downloadBar.classList.add("hidden");
        }, 1500);

    } catch (err) {
        console.error("Progressive download failure: ", err);
        alert("Có lỗi trong quá trình tải tệp tin.");
        if (downloadBar) downloadBar.classList.add("hidden");
    }
}

// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Right panel drawer updates
function updateSharedFilesDrawer(messages) {
    sharedImagesGrid.innerHTML = "";
    sharedFilesList.innerHTML = "";

    const files = messages.filter(m => m.fileUrl);
    
    files.forEach(f => {
        if (f.fileType === "image") {
            let fullFileUrl = f.fileUrl;
            if (f.fileUrl.startsWith("/")) {
                fullFileUrl = serverBaseUrl + f.fileUrl;
            }
            const div = document.createElement("div");
            div.className = "shared-image-item";
            div.onclick = () => showLightbox(fullFileUrl, f.fileName);
            div.innerHTML = `<img src="${fullFileUrl}" alt="${f.fileName}" />`;
            sharedImagesGrid.appendChild(div);
        } else {
            const row = document.createElement("a");
            row.className = "shared-file-row";
            row.href = "#";
            row.onclick = (e) => {
                e.preventDefault();
                downloadFileWithProgress(f.fileName, f.fileSize, f.id);
            };

            const ext = f.fileName.split('.').pop().toUpperCase();
            row.innerHTML = `
                <div class="file-icon-box" style="width:32px;height:32px;font-size:10px;">${ext}</div>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">
                    <div class="file-name-text" style="font-size:12px;">${f.fileName}</div>
                    <div class="file-size-text">${formatBytes(f.fileSize)}</div>
                </div>
            `;
            sharedFilesList.appendChild(row);
        }
    });
}
