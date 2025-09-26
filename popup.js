document.addEventListener('DOMContentLoaded', async () => {
    const channelNameEl = document.getElementById('channel-name');
    const addLikeBtn = document.getElementById('add-like');
    const addDislikeBtn = document.getElementById('add-dislike');
    const channelStatusEl = document.getElementById('channel-status');
    const statusTextEl = document.getElementById('status-text');
    const openSettingsBtn = document.getElementById('open-settings');

    let currentChannel = null;

    // Get current tab and extract channel info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab?.url?.includes('youtube.com')) {
        // Send message to content script to get current channel
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getCurrentChannel' });
            if (response?.channel) {
                currentChannel = response.channel;
                channelNameEl.textContent = currentChannel.name || currentChannel.handle;
                addLikeBtn.disabled = false;
                addDislikeBtn.disabled = false;

                // Check if channel is already in lists
                await checkChannelStatus();
            }
        } catch (error) {
            channelNameEl.textContent = 'Unable to detect channel';
        }
    } else {
        channelNameEl.textContent = 'Not on YouTube';
    }

    async function checkChannelStatus() {
        if (!currentChannel) return;

        const { likeChannels = [], dislikeChannels = [] } = await chrome.storage.sync.get(['likeChannels', 'dislikeChannels']);

        const isInLikes = likeChannels.includes(currentChannel.handle);
        const isInDislikes = dislikeChannels.includes(currentChannel.handle);

        if (isInLikes) {
            statusTextEl.textContent = '✓ Channel in Auto-Like list';
            channelStatusEl.style.display = 'block';
            channelStatusEl.className = 'channel-status';
            addLikeBtn.textContent = '👍 Remove from Auto-Like';
        } else if (isInDislikes) {
            statusTextEl.textContent = '✓ Channel in Auto-Dislike list';
            channelStatusEl.style.display = 'block';
            channelStatusEl.className = 'channel-status in-dislike';
            addDislikeBtn.textContent = '👎 Remove from Auto-Dislike';
        }
    }

    addLikeBtn.addEventListener('click', async () => {
        if (!currentChannel) return;

        const { likeChannels = [], dislikeChannels = [] } = await chrome.storage.sync.get(['likeChannels', 'dislikeChannels']);

        if (likeChannels.includes(currentChannel.handle)) {
            // Remove from likes
            const updatedLikes = likeChannels.filter(ch => ch !== currentChannel.handle);
            await chrome.storage.sync.set({ likeChannels: updatedLikes });
            addLikeBtn.innerHTML = '<span class="icon">👍</span>Add to Auto-Like';
            channelStatusEl.style.display = 'none';
        } else {
            // Add to likes, remove from dislikes if present
            const updatedLikes = [...likeChannels, currentChannel.handle];
            const updatedDislikes = dislikeChannels.filter(ch => ch !== currentChannel.handle);

            await chrome.storage.sync.set({
                likeChannels: updatedLikes,
                dislikeChannels: updatedDislikes
            });

            addLikeBtn.innerHTML = '<span class="icon">👍</span>Remove from Auto-Like';
            addDislikeBtn.innerHTML = '<span class="icon">👎</span>Add to Auto-Dislike';
            statusTextEl.textContent = '✓ Channel added to Auto-Like list';
            channelStatusEl.style.display = 'block';
            channelStatusEl.className = 'channel-status';
        }
    });

    addDislikeBtn.addEventListener('click', async () => {
        if (!currentChannel) return;

        const { likeChannels = [], dislikeChannels = [] } = await chrome.storage.sync.get(['likeChannels', 'dislikeChannels']);

        if (dislikeChannels.includes(currentChannel.handle)) {
            // Remove from dislikes
            const updatedDislikes = dislikeChannels.filter(ch => ch !== currentChannel.handle);
            await chrome.storage.sync.set({ dislikeChannels: updatedDislikes });
            addDislikeBtn.innerHTML = '<span class="icon">👎</span>Add to Auto-Dislike';
            channelStatusEl.style.display = 'none';
        } else {
            // Add to dislikes, remove from likes if present
            const updatedDislikes = [...dislikeChannels, currentChannel.handle];
            const updatedLikes = likeChannels.filter(ch => ch !== currentChannel.handle);

            await chrome.storage.sync.set({
                likeChannels: updatedLikes,
                dislikeChannels: updatedDislikes
            });

            addDislikeBtn.innerHTML = '<span class="icon">👎</span>Remove from Auto-Dislike';
            addLikeBtn.innerHTML = '<span class="icon">👍</span>Add to Auto-Like';
            statusTextEl.textContent = '✓ Channel added to Auto-Dislike list';
            channelStatusEl.style.display = 'block';
            channelStatusEl.className = 'channel-status in-dislike';
        }
    });

    openSettingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});