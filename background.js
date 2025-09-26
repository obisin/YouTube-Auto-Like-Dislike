// YouTube Auto Like/Dislike Background Script

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        // Set default settings
        const defaultSettings = {
            enableLikes: true,
            enableDislikes: true,
            likeChannels: [],
            dislikeChannels: []
        };

        await chrome.storage.sync.set(defaultSettings);
        console.log('YouTube Auto Like/Dislike: Extension installed with default settings');

        // Open options page for first-time setup
        chrome.runtime.openOptionsPage();
    } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
        console.log('YouTube Auto Like/Dislike: Extension updated to version', chrome.runtime.getManifest().version);

        // Handle any migration logic here if needed for future updates
        await handleVersionUpdate(details.previousVersion);
    }
});

// Handle version updates and migrations
async function handleVersionUpdate(previousVersion) {
    // Get current settings
    const currentSettings = await chrome.storage.sync.get([
        'enableLikes',
        'enableDislikes',
        'likeChannels',
        'dislikeChannels'
    ]);

    // Set defaults for any missing settings (backward compatibility)
    const updatedSettings = {
        enableLikes: currentSettings.enableLikes ?? true,
        enableDislikes: currentSettings.enableDislikes ?? true,
        likeChannels: currentSettings.likeChannels ?? [],
        dislikeChannels: currentSettings.dislikeChannels ?? []
    };

    // Save updated settings
    await chrome.storage.sync.set(updatedSettings);

    console.log('YouTube Auto Like/Dislike: Settings migrated from version', previousVersion);
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getSettings':
            handleGetSettings(sendResponse);
            return true; // Keep channel open for async response

        case 'saveSettings':
            handleSaveSettings(request.settings, sendResponse);
            return true;

        case 'addChannel':
            handleAddChannel(request.channel, request.type, sendResponse);
            return true;

        case 'removeChannel':
            handleRemoveChannel(request.channel, request.type, sendResponse);
            return true;

        case 'checkChannelStatus':
            handleCheckChannelStatus(request.channel, sendResponse);
            return true;

        default:
            console.log('YouTube Auto Like/Dislike: Unknown action:', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

async function handleGetSettings(sendResponse) {
    try {
        const settings = await chrome.storage.sync.get([
            'enableLikes',
            'enableDislikes',
            'likeChannels',
            'dislikeChannels'
        ]);

        sendResponse({
            success: true,
            settings: {
                enableLikes: settings.enableLikes ?? true,
                enableDislikes: settings.enableDislikes ?? true,
                likeChannels: settings.likeChannels ?? [],
                dislikeChannels: settings.dislikeChannels ?? []
            }
        });
    } catch (error) {
        console.error('YouTube Auto Like/Dislike: Error getting settings:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleSaveSettings(newSettings, sendResponse) {
    try {
        await chrome.storage.sync.set(newSettings);
        sendResponse({ success: true });
    } catch (error) {
        console.error('YouTube Auto Like/Dislike: Error saving settings:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleAddChannel(channelHandle, type, sendResponse) {
    try {
        // Normalize channel handle
        const normalizedHandle = channelHandle.startsWith('@') ? channelHandle : `@${channelHandle}`;

        // Get current data
        const { likeChannels = [], dislikeChannels = [] } = await chrome.storage.sync.get([
            'likeChannels',
            'dislikeChannels'
        ]);

        // Prevent conflicts - remove from opposite list
        let updatedLikeChannels = [...likeChannels];
        let updatedDislikeChannels = [...dislikeChannels];

        if (type === 'like') {
            // Check if already in like list
            if (updatedLikeChannels.includes(normalizedHandle)) {
                sendResponse({ success: false, error: 'Channel already in like list' });
                return;
            }

            // Add to like list, remove from dislike list
            updatedLikeChannels.push(normalizedHandle);
            updatedDislikeChannels = updatedDislikeChannels.filter(ch => ch !== normalizedHandle);
        } else if (type === 'dislike') {
            // Check if already in dislike list
            if (updatedDislikeChannels.includes(normalizedHandle)) {
                sendResponse({ success: false, error: 'Channel already in dislike list' });
                return;
            }

            // Add to dislike list, remove from like list
            updatedDislikeChannels.push(normalizedHandle);
            updatedLikeChannels = updatedLikeChannels.filter(ch => ch !== normalizedHandle);
        }

        // Save updated lists
        await chrome.storage.sync.set({
            likeChannels: updatedLikeChannels,
            dislikeChannels: updatedDislikeChannels
        });

        sendResponse({
            success: true,
            likeChannels: updatedLikeChannels,
            dislikeChannels: updatedDislikeChannels
        });
    } catch (error) {
        console.error('YouTube Auto Like/Dislike: Error adding channel:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleRemoveChannel(channelHandle, type, sendResponse) {
    try {
        const { likeChannels = [], dislikeChannels = [] } = await chrome.storage.sync.get([
            'likeChannels',
            'dislikeChannels'
        ]);

        let updatedChannels;
        if (type === 'like') {
            updatedChannels = likeChannels.filter(ch => ch !== channelHandle);
            await chrome.storage.sync.set({ likeChannels: updatedChannels });
        } else {
            updatedChannels = dislikeChannels.filter(ch => ch !== channelHandle);
            await chrome.storage.sync.set({ dislikeChannels: updatedChannels });
        }

        sendResponse({ success: true, channels: updatedChannels });
    } catch (error) {
        console.error('YouTube Auto Like/Dislike: Error removing channel:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleCheckChannelStatus(channelHandle, sendResponse) {
    try {
        const { likeChannels = [], dislikeChannels = [] } = await chrome.storage.sync.get([
            'likeChannels',
            'dislikeChannels'
        ]);

        const status = {
            inLikeList: likeChannels.includes(channelHandle),
            inDislikeList: dislikeChannels.includes(channelHandle)
        };

        sendResponse({ success: true, status });
    } catch (error) {
        console.error('YouTube Auto Like/Dislike: Error checking channel status:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle storage changes and notify content scripts if needed
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        console.log('YouTube Auto Like/Dislike: Settings updated', changes);

        // Could notify active YouTube tabs about setting changes
        // This allows real-time updates without page refresh
        notifyActiveYouTubeTabs(changes);
    }
});

async function notifyActiveYouTubeTabs(changes) {
    try {
        const tabs = await chrome.tabs.query({ url: '*://www.youtube.com/*' });

        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'settingsUpdated',
                    changes: changes
                });
            } catch (error) {
                // Tab might not have content script loaded, ignore
            }
        }
    } catch (error) {
        console.error('YouTube Auto Like/Dislike: Error notifying tabs:', error);
    }
}

// Periodic cleanup of storage (optional, for future use)
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cleanup') {
        await performStorageCleanup();
    }
});

async function performStorageCleanup() {
    try {
        const { likeChannels = [], dislikeChannels = [] } = await chrome.storage.sync.get([
            'likeChannels',
            'dislikeChannels'
        ]);

        // Remove any duplicate or invalid entries
        const cleanedLikeChannels = [...new Set(likeChannels.filter(ch => ch && ch.trim()))];
        const cleanedDislikeChannels = [...new Set(dislikeChannels.filter(ch => ch && ch.trim()))];

        if (likeChannels.length !== cleanedLikeChannels.length ||
            dislikeChannels.length !== cleanedDislikeChannels.length) {

            await chrome.storage.sync.set({
                likeChannels: cleanedLikeChannels,
                dislikeChannels: cleanedDislikeChannels
            });

            console.log('YouTube Auto Like/Dislike: Storage cleaned up');
        }
    } catch (error) {
        console.error('YouTube Auto Like/Dislike: Error during cleanup:', error);
    }
}

// Set up periodic cleanup (runs once a day)
chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create('cleanup', { delayInMinutes: 1440, periodInMinutes: 1440 });
});