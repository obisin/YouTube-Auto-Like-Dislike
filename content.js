// YouTube Auto Like/Dislike Content Script

let currentUrl = '';
let currentChannel = null;
let isProcessing = false;

// Initialize on page load
initialize();

// Listen for navigation changes
const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        handleNavigation();
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

function initialize() {
    currentUrl = window.location.href;
    handleNavigation();
}

async function handleNavigation() {
    // Reset processing state
    isProcessing = false;
    currentChannel = null;

    // Check if we're on a video page
    if (!isVideoPage()) {
        return;
    }

    // Wait for page content to load
    await waitForVideoLoad();

    // Get channel information
    currentChannel = await getChannelInfo();

    if (currentChannel) {
        // Check if we should auto-like or auto-dislike
        await checkAndPerformAction();
    }
}

function isVideoPage() {
    return window.location.pathname === '/watch' && window.location.search.includes('v=');
}

async function waitForVideoLoad() {
    return new Promise((resolve) => {
        const checkForVideo = () => {
            const videoElement = document.querySelector('video');
            const titleElement = document.querySelector('#title h1');
            const channelElement = document.querySelector('#owner #channel-name a') ||
                                  document.querySelector('#upload-info #owner-text a') ||
                                  document.querySelector('ytd-channel-name a');

            if (videoElement && titleElement && channelElement) {
                resolve();
            } else {
                setTimeout(checkForVideo, 500);
            }
        };
        checkForVideo();
    });
}

async function waitForLikeButton(maxWaitTime = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log('YouTube Auto Like/Dislike: Waiting for like button to load...');

        const checkForLikeButton = () => {
            const elapsed = Date.now() - startTime;

            // Try to find like button using our selectors
            const likeSelectors = [
                '#top-level-buttons-computed > segmented-like-dislike-button-view-model > yt-smartimation > div > div > like-button-view-model > toggle-button-view-model > button-view-model > button > yt-touch-feedback-shape > div.yt-spec-touch-feedback-shape__fill',
                '#top-level-buttons-computed > segmented-like-dislike-button-view-model > yt-smartimation > div > div > like-button-view-model > toggle-button-view-model > button-view-model > button',
                'like-button-view-model > toggle-button-view-model > button-view-model > button'
            ];

            let likeButton = null;
            for (const selector of likeSelectors) {
                likeButton = document.querySelector(selector);
                if (likeButton) {
                    console.log(`YouTube Auto Like/Dislike: Like button found after ${elapsed}ms with selector:`, selector);
                    resolve(likeButton);
                    return;
                }
            }

            // Check timeout
            if (elapsed >= maxWaitTime) {
                console.log(`YouTube Auto Like/Dislike: Like button not found after ${elapsed}ms, giving up`);
                reject(new Error('Like button not found within timeout'));
                return;
            }

            // Continue waiting
            setTimeout(checkForLikeButton, 200);
        };

        checkForLikeButton();
    });
}

async function waitForDislikeButton(maxWaitTime = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log('YouTube Auto Like/Dislike: Waiting for dislike button to load...');

        const checkForDislikeButton = () => {
            const elapsed = Date.now() - startTime;

            // Try to find dislike button using our selectors
            const dislikeSelectors = [
                '#top-level-buttons-computed > segmented-like-dislike-button-view-model > yt-smartimation > div > div > dislike-button-view-model > toggle-button-view-model > button-view-model > button > yt-touch-feedback-shape > div.yt-spec-touch-feedback-shape__fill',
                '#top-level-buttons-computed > segmented-like-dislike-button-view-model > yt-smartimation > div > div > dislike-button-view-model > toggle-button-view-model > button-view-model > button',
                'dislike-button-view-model > toggle-button-view-model > button-view-model > button'
            ];

            let dislikeButton = null;
            for (const selector of dislikeSelectors) {
                dislikeButton = document.querySelector(selector);
                if (dislikeButton) {
                    console.log(`YouTube Auto Like/Dislike: Dislike button found after ${elapsed}ms with selector:`, selector);
                    resolve(dislikeButton);
                    return;
                }
            }

            // Check timeout
            if (elapsed >= maxWaitTime) {
                console.log(`YouTube Auto Like/Dislike: Dislike button not found after ${elapsed}ms, giving up`);
                reject(new Error('Dislike button not found within timeout'));
                return;
            }

            // Continue waiting
            setTimeout(checkForDislikeButton, 200);
        };

        checkForDislikeButton();
    });
}

async function getChannelInfo() {
    // Try multiple selectors for channel info (YouTube layout changes frequently)
    const channelSelectors = [
        '#owner #channel-name a',
        '#upload-info #owner-text a',
        'ytd-channel-name a',
        '#channel-name a',
        '.ytd-video-owner-renderer a'
    ];

    let channelElement = null;
    for (const selector of channelSelectors) {
        channelElement = document.querySelector(selector);
        if (channelElement) break;
    }

    if (!channelElement) {
        console.log('YouTube Auto Like/Dislike: Could not find channel element');
        return null;
    }

    const channelUrl = channelElement.href;
    const channelName = channelElement.textContent.trim();

    // Extract channel handle from URL
    let channelHandle = null;

    // Try to get handle from URL patterns
    if (channelUrl.includes('/@')) {
        channelHandle = '@' + channelUrl.split('/@')[1].split('?')[0].split('/')[0];
    } else if (channelUrl.includes('/channel/')) {
        const channelId = channelUrl.split('/channel/')[1].split('?')[0].split('/')[0];
        channelHandle = channelId; // Fallback to channel ID
    } else if (channelUrl.includes('/c/')) {
        const customUrl = channelUrl.split('/c/')[1].split('?')[0].split('/')[0];
        channelHandle = '@' + customUrl; // Convert custom URL to handle format
    } else if (channelUrl.includes('/user/')) {
        const username = channelUrl.split('/user/')[1].split('?')[0].split('/')[0];
        channelHandle = '@' + username; // Convert username to handle format
    }

    if (!channelHandle) {
        console.log('YouTube Auto Like/Dislike: Could not extract channel handle');
        return null;
    }

    return {
        name: channelName,
        handle: channelHandle,
        url: channelUrl
    };
}

async function checkAndPerformAction() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        console.log('YouTube Auto Like/Dislike: Checking action for channel:', currentChannel);

        // Get settings and channel lists
        const {
            enableLikes = true,
            enableDislikes = true,
            likeChannels = [],
            dislikeChannels = []
        } = await chrome.storage.sync.get(['enableLikes', 'enableDislikes', 'likeChannels', 'dislikeChannels']);

        console.log('YouTube Auto Like/Dislike: Settings:', {
            enableLikes,
            enableDislikes,
            likeChannels,
            dislikeChannels
        });

        const shouldLike = enableLikes && likeChannels.includes(currentChannel.handle);
        const shouldDislike = enableDislikes && dislikeChannels.includes(currentChannel.handle);

        console.log('YouTube Auto Like/Dislike: Action decision:', {
            shouldLike,
            shouldDislike,
            channelHandle: currentChannel.handle
        });

        if (shouldLike) {
            console.log('YouTube Auto Like/Dislike: Attempting to like video');
            await performLike();
        } else if (shouldDislike) {
            console.log('YouTube Auto Like/Dislike: Attempting to dislike video');
            await performDislike();
        } else {
            console.log('YouTube Auto Like/Dislike: No action needed for this channel');
        }
    } catch (error) {
        console.error('YouTube Auto Like/Dislike: Error checking action:', error);
    } finally {
        isProcessing = false;
    }
}

async function performLike() {
    const startTime = Date.now();
    console.log('YouTube Auto Like/Dislike: Starting performLike() at', new Date().toISOString());

    // Fast approach first: Wait briefly for like button (loads quickly)
    await new Promise(resolve => setTimeout(resolve, 1000));

    let likeButton = await findLikeButton();
    if (!likeButton) {
        console.log('YouTube Auto Like/Dislike: Like button not found immediately, trying robust fallback...');

        try {
            // Fallback: Use robust polling method similar to dislike
            likeButton = await waitForLikeButton(5000);
        } catch (error) {
            console.error('YouTube Auto Like/Dislike: Failed to find like button even with fallback:', error.message);
            return;
        }
    }

    console.log('YouTube Auto Like/Dislike: Found like button after', Date.now() - startTime, 'ms:', likeButton);

    if (isLikeButtonActive(likeButton)) {
        console.log('YouTube Auto Like/Dislike: Like button already active, skipping');
        return;
    }

    try {
        likeButton.click();
        console.log('YouTube Auto Like/Dislike: Successfully clicked like button for', currentChannel.name, 'at', Date.now() - startTime, 'ms');

        // Wait a moment and verify the action worked
        setTimeout(() => {
            const isNowActive = isLikeButtonActive(likeButton);
            console.log('YouTube Auto Like/Dislike: Like button active after click:', isNowActive, 'at', Date.now() - startTime, 'ms');
        }, 500);
    } catch (error) {
        console.error('YouTube Auto Like/Dislike: Error clicking like button:', error);

        // Additional fallback: try using the fallback button finder one more time
        console.log('YouTube Auto Like/Dislike: Trying final fallback like method...');
        const fallbackButton = await findLikeButton();
        if (fallbackButton && !isLikeButtonActive(fallbackButton)) {
            try {
                fallbackButton.click();
                console.log('YouTube Auto Like/Dislike: Fallback like click attempted');
            } catch (fallbackError) {
                console.error('YouTube Auto Like/Dislike: Fallback like also failed:', fallbackError);
            }
        }
    }
}

async function performDislike() {
    const startTime = Date.now();
    console.log('YouTube Auto Like/Dislike: Starting performDislike() at', new Date().toISOString());

    // Wait longer for dislike button since it loads with secondary engagement buttons
    console.log('YouTube Auto Like/Dislike: Waiting for page load and dislike button availability...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        // Wait specifically for dislike button to appear (up to 10 seconds)
        const dislikeButton = await waitForDislikeButton(10000);

        console.log('YouTube Auto Like/Dislike: Found dislike button after', Date.now() - startTime, 'ms:', dislikeButton);

        if (isDislikeButtonActive(dislikeButton)) {
            console.log('YouTube Auto Like/Dislike: Dislike button already active, skipping');
            return;
        }

        // Click the dislike button
        dislikeButton.click();
        console.log('YouTube Auto Like/Dislike: Successfully clicked dislike button for', currentChannel.name, 'at', Date.now() - startTime, 'ms');

        // Wait a moment and verify the action worked
        setTimeout(() => {
            const isNowActive = isDislikeButtonActive(dislikeButton);
            console.log('YouTube Auto Like/Dislike: Dislike button active after click:', isNowActive, 'at', Date.now() - startTime, 'ms');
        }, 500);

    } catch (error) {
        console.error('YouTube Auto Like/Dislike: Failed to dislike video:', error.message);

        // Fallback: try the old method one more time
        console.log('YouTube Auto Like/Dislike: Trying fallback dislike method...');
        const fallbackButton = await findDislikeButton();
        if (fallbackButton && !isDislikeButtonActive(fallbackButton)) {
            try {
                fallbackButton.click();
                console.log('YouTube Auto Like/Dislike: Fallback dislike click attempted');
            } catch (fallbackError) {
                console.error('YouTube Auto Like/Dislike: Fallback dislike also failed:', fallbackError);
            }
        }
    }
}

async function findLikeButton() {
    const likeSelectors = [
        // New YouTube view-model structure (2024+) - Target the actual clickable touch feedback element
        '#top-level-buttons-computed > segmented-like-dislike-button-view-model > yt-smartimation > div > div > like-button-view-model > toggle-button-view-model > button-view-model > button > yt-touch-feedback-shape > div.yt-spec-touch-feedback-shape__fill',
        '#top-level-buttons-computed > segmented-like-dislike-button-view-model > yt-smartimation > div > div > like-button-view-model > toggle-button-view-model > button-view-model > button',
        'like-button-view-model > toggle-button-view-model > button-view-model > button > yt-touch-feedback-shape > div.yt-spec-touch-feedback-shape__fill',
        'like-button-view-model > toggle-button-view-model > button-view-model > button',
        'segmented-like-dislike-button-view-model like-button-view-model button',

        // Fallback selectors for older layouts
        '#top-level-buttons-computed button[title*="like"]:not([title*="dislike"])',
        '#top-level-buttons button[aria-label*="like"]:not([aria-label*="dislike"])',
        '.ytd-toggle-button-renderer button[title*="like"]:not([title*="dislike"])',
        '#segmented-like-button button',
        'ytd-toggle-button-renderer:first-child button'
    ];

    for (const selector of likeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('YouTube Auto Like/Dislike: Found like button with selector:', selector);
            return element;
        }
    }

    console.log('YouTube Auto Like/Dislike: Could not find like button');
    return null;
}

async function findDislikeButton() {
    const dislikeSelectors = [
        // New YouTube view-model structure (2024+) - Target the actual clickable touch feedback element
        '#top-level-buttons-computed > segmented-like-dislike-button-view-model > yt-smartimation > div > div > dislike-button-view-model > toggle-button-view-model > button-view-model > button > yt-touch-feedback-shape > div.yt-spec-touch-feedback-shape__fill',
        '#top-level-buttons-computed > segmented-like-dislike-button-view-model > yt-smartimation > div > div > dislike-button-view-model > toggle-button-view-model > button-view-model > button',
        'dislike-button-view-model > toggle-button-view-model > button-view-model > button > yt-touch-feedback-shape > div.yt-spec-touch-feedback-shape__fill',
        'dislike-button-view-model > toggle-button-view-model > button-view-model > button',
        'segmented-like-dislike-button-view-model dislike-button-view-model button',

        // Fallback selectors for older layouts
        '#top-level-buttons-computed button[title*="dislike"]',
        '#top-level-buttons button[aria-label*="dislike"]',
        '.ytd-toggle-button-renderer button[title*="dislike"]',
        '#segmented-dislike-button button',
        'ytd-toggle-button-renderer:last-child button'
    ];

    for (const selector of dislikeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('YouTube Auto Like/Dislike: Found dislike button with selector:', selector);
            return element;
        }
    }

    console.log('YouTube Auto Like/Dislike: Could not find dislike button');
    return null;
}

function isLikeButtonActive(element) {
    // Since we might be targeting the touch feedback div, find the actual button element
    const button = element.tagName === 'BUTTON' ? element : element.closest('button');

    if (!button) {
        console.log('YouTube Auto Like/Dislike: Could not find button element for state check');
        return false;
    }

    // Method 1: Check aria-pressed attribute (most reliable)
    if (button.getAttribute('aria-pressed') === 'true') {
        console.log('YouTube Auto Like/Dislike: Like button already active (aria-pressed)');
        return true;
    }

    // Method 2: Check for active class on button
    if (button.classList.contains('style-default-active')) {
        console.log('YouTube Auto Like/Dislike: Like button already active (style-default-active)');
        return true;
    }

    // Method 3: Check parent view-model for active states
    const viewModel = button.closest('like-button-view-model');
    if (viewModel && viewModel.hasAttribute('like-status') && viewModel.getAttribute('like-status') === 'LIKE') {
        console.log('YouTube Auto Like/Dislike: Like button already active (view-model status)');
        return true;
    }

    // Method 4: Look for filled/active icon path in SVG
    const svgPath = button.querySelector('svg path[d*="8.59"]');
    if (svgPath) {
        console.log('YouTube Auto Like/Dislike: Like button already active (SVG path)');
        return true;
    }

    // Method 5: Check if the view-model has active styling
    if (viewModel && (viewModel.classList.contains('activated') || viewModel.getAttribute('is-activated') === 'true')) {
        console.log('YouTube Auto Like/Dislike: Like button already active (view-model activated)');
        return true;
    }

    return false;
}

function isDislikeButtonActive(element) {
    // Since we might be targeting the touch feedback div, find the actual button element
    const button = element.tagName === 'BUTTON' ? element : element.closest('button');

    if (!button) {
        console.log('YouTube Auto Like/Dislike: Could not find button element for state check');
        return false;
    }

    // Method 1: Check aria-pressed attribute (most reliable)
    if (button.getAttribute('aria-pressed') === 'true') {
        console.log('YouTube Auto Like/Dislike: Dislike button already active (aria-pressed)');
        return true;
    }

    // Method 2: Check for active class on button
    if (button.classList.contains('style-default-active')) {
        console.log('YouTube Auto Like/Dislike: Dislike button already active (style-default-active)');
        return true;
    }

    // Method 3: Check parent view-model for active states
    const viewModel = button.closest('dislike-button-view-model');
    if (viewModel && viewModel.hasAttribute('like-status') && viewModel.getAttribute('like-status') === 'DISLIKE') {
        console.log('YouTube Auto Like/Dislike: Dislike button already active (view-model status)');
        return true;
    }

    // Method 4: Check for visual indicators of active state (removed tonal check as it's default styling)
    // Note: yt-spec-button-shape-next--tonal is default styling, not active state

    // Method 5: Check if the view-model has active styling
    if (viewModel && (viewModel.classList.contains('activated') || viewModel.getAttribute('is-activated') === 'true')) {
        console.log('YouTube Auto Like/Dislike: Dislike button already active (view-model activated)');
        return true;
    }

    return false;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCurrentChannel') {
        sendResponse({ channel: currentChannel });
    }
    return true;
});

// Re-check when URL changes (for single-page app navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => {
            initialize();
        }, 1000); // Give YouTube time to load new content
    }
}).observe(document, { subtree: true, childList: true });