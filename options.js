document.addEventListener('DOMContentLoaded', async () => {
    const enableLikesToggle = document.getElementById('enable-likes');
    const enableDislikesToggle = document.getElementById('enable-dislikes');
    const likeChannelInput = document.getElementById('like-channel-input');
    const dislikeChannelInput = document.getElementById('dislike-channel-input');
    const addLikeChannelBtn = document.getElementById('add-like-channel');
    const addDislikeChannelBtn = document.getElementById('add-dislike-channel');
    const likeChannelsList = document.getElementById('like-channels-list');
    const dislikeChannelsList = document.getElementById('dislike-channels-list');
    const exportBtn = document.getElementById('export-settings');
    const importBtn = document.getElementById('import-settings');
    const importFile = document.getElementById('import-file');
    const statusMessage = document.getElementById('status-message');

    // Load settings
    await loadSettings();
    await loadChannels();

    // Event listeners
    enableLikesToggle.addEventListener('change', saveSettings);
    enableDislikesToggle.addEventListener('change', saveSettings);

    addLikeChannelBtn.addEventListener('click', () => addChannel('like'));
    addDislikeChannelBtn.addEventListener('click', () => addChannel('dislike'));

    likeChannelInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addChannel('like');
    });

    dislikeChannelInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addChannel('dislike');
    });

    exportBtn.addEventListener('click', exportSettings);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importSettings);

    async function loadSettings() {
        const { enableLikes = true, enableDislikes = true } = await chrome.storage.sync.get(['enableLikes', 'enableDislikes']);

        enableLikesToggle.checked = enableLikes;
        enableDislikesToggle.checked = enableDislikes;
    }

    async function saveSettings() {
        const settings = {
            enableLikes: enableLikesToggle.checked,
            enableDislikes: enableDislikesToggle.checked
        };

        await chrome.storage.sync.set(settings);
        showStatus('Settings saved successfully!', 'success');
    }

    async function loadChannels() {
        const { likeChannels = [], dislikeChannels = [] } = await chrome.storage.sync.get(['likeChannels', 'dislikeChannels']);

        renderChannelList(likeChannels, likeChannelsList, 'like');
        renderChannelList(dislikeChannels, dislikeChannelsList, 'dislike');
    }

    function renderChannelList(channels, container, type) {
        if (channels.length === 0) {
            container.innerHTML = `<div class="no-channels">No channels in ${type} list</div>`;
            return;
        }

        container.innerHTML = channels.map(channel => `
            <div class="channel-item">
                <span class="channel-name">${channel}</span>
                <button class="remove-btn" data-channel="${channel}" data-type="${type}">Remove</button>
            </div>
        `).join('');

        // Add remove button listeners
        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => removeChannel(btn.dataset.channel, btn.dataset.type));
        });
    }

    async function addChannel(type) {
        const input = type === 'like' ? likeChannelInput : dislikeChannelInput;
        const channelHandle = input.value.trim();

        if (!channelHandle) {
            showStatus('Please enter a channel handle', 'error');
            return;
        }

        // Normalize channel handle
        const normalizedHandle = channelHandle.startsWith('@') ? channelHandle : `@${channelHandle}`;

        // Get current data
        const { likeChannels = [], dislikeChannels = [] } = await chrome.storage.sync.get(['likeChannels', 'dislikeChannels']);

        // Check for conflicts
        if (type === 'like') {
            if (likeChannels.includes(normalizedHandle)) {
                showStatus('Channel already in like list', 'error');
                return;
            }

            // Remove from dislike list if present (conflict prevention)
            const updatedDislikeChannels = dislikeChannels.filter(ch => ch !== normalizedHandle);
            const updatedLikeChannels = [...likeChannels, normalizedHandle];

            await chrome.storage.sync.set({
                likeChannels: updatedLikeChannels,
                dislikeChannels: updatedDislikeChannels
            });

            renderChannelList(updatedLikeChannels, likeChannelsList, 'like');
            renderChannelList(updatedDislikeChannels, dislikeChannelsList, 'dislike');

            showStatus('Channel added to like list', 'success');
        } else {
            if (dislikeChannels.includes(normalizedHandle)) {
                showStatus('Channel already in dislike list', 'error');
                return;
            }

            // Remove from like list if present (conflict prevention)
            const updatedLikeChannels = likeChannels.filter(ch => ch !== normalizedHandle);
            const updatedDislikeChannels = [...dislikeChannels, normalizedHandle];

            await chrome.storage.sync.set({
                likeChannels: updatedLikeChannels,
                dislikeChannels: updatedDislikeChannels
            });

            renderChannelList(updatedLikeChannels, likeChannelsList, 'like');
            renderChannelList(updatedDislikeChannels, dislikeChannelsList, 'dislike');

            showStatus('Channel added to dislike list', 'success');
        }

        input.value = '';
    }

    async function removeChannel(channelHandle, type) {
        const { likeChannels = [], dislikeChannels = [] } = await chrome.storage.sync.get(['likeChannels', 'dislikeChannels']);

        if (type === 'like') {
            const updatedChannels = likeChannels.filter(ch => ch !== channelHandle);
            await chrome.storage.sync.set({ likeChannels: updatedChannels });
            renderChannelList(updatedChannels, likeChannelsList, 'like');
            showStatus('Channel removed from like list', 'success');
        } else {
            const updatedChannels = dislikeChannels.filter(ch => ch !== channelHandle);
            await chrome.storage.sync.set({ dislikeChannels: updatedChannels });
            renderChannelList(updatedChannels, dislikeChannelsList, 'dislike');
            showStatus('Channel removed from dislike list', 'success');
        }
    }

    async function exportSettings() {
        const data = await chrome.storage.sync.get(['enableLikes', 'enableDislikes', 'likeChannels', 'dislikeChannels']);

        const exportData = {
            ...data,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube-auto-like-dislike-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
        showStatus('Settings exported successfully!', 'success');
    }

    async function importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate data structure
            if (!data.hasOwnProperty('enableLikes') || !data.hasOwnProperty('enableDislikes')) {
                throw new Error('Invalid settings file format');
            }

            // Import settings
            await chrome.storage.sync.set({
                enableLikes: data.enableLikes || true,
                enableDislikes: data.enableDislikes || true,
                likeChannels: data.likeChannels || [],
                dislikeChannels: data.dislikeChannels || []
            });

            // Reload UI
            await loadSettings();
            await loadChannels();

            showStatus('Settings imported successfully!', 'success');
        } catch (error) {
            showStatus('Error importing settings: ' + error.message, 'error');
        }

        // Reset file input
        event.target.value = '';
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';

        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }
});