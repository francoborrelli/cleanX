const BEARER_TOKEN = '';
const X_CLIENT_TRANSACTION_ID = '';
const X_CSRF_TOKEN = '';
const REFERRER = 'https://x.com/<YOUR_USERNAME>';
const X_XP_FORWARDED_FOR =
  '';


const QUERY_ID = 'VaenaVgh5q5ih7kvyVjgtg';
const QUERY_ID_RETWEET = 'iQtK4dl5hBmXewYZuEOKVw';

const headers = {
  accept: '*/*',
  'accept-language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7,es-419;q=0.6,zh-CN;q=0.5,zh;q=0.4',
  authorization: BEARER_TOKEN,
  'content-type': 'application/json',
  origin: 'https://x.com',
  priority: 'u=1, i',
  referer: REFERRER,
  'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
  'sec-ch-ua-arch': '"x86"',
  'sec-ch-ua-bitness': '"64"',
  'sec-ch-ua-full-version-list':
    '"Not)A;Brand";v="8.0.0.0", "Chromium";v="138.0.0.0", "Google Chrome";v="138.0.0.0"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-model': '""',
  'sec-ch-ua-platform': '"macOS"',
  'sec-ch-ua-platform-version': '"14.0.0"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'sec-gpc': '1',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  'x-client-transaction-id': X_CLIENT_TRANSACTION_ID,
  'x-csrf-token': X_CSRF_TOKEN,
  'x-twitter-active-user': 'yes',
  'x-twitter-auth-type': 'OAuth2Session',
  'x-twitter-client-language': 'es',
  'x-xp-forwarded-for': X_XP_FORWARDED_FOR,
};

// Global function to get tweet IDs - can be used by both autoDeleteAllTweets and checkCurrentTweets
function getMyTweetIds() {
  const profileUsername = window.location.pathname.split('/')[1];

  // Try multiple selectors to find all tweet articles
  const selectors = [
    'article[data-testid*="tweet"]',
    'article[data-testid="tweet"]',
    'div[data-testid="cellInnerDiv"] article',
    'div[role="article"]',
  ];

  let allTweetArticles = [];
  for (const selector of selectors) {
    const found = document.querySelectorAll(selector);
    console.log(`🔍 Selector "${selector}" found ${found.length} elements`);
    allTweetArticles = [...allTweetArticles, ...found];
  }

  // Remove duplicates
  allTweetArticles = [...new Set(allTweetArticles)];
  console.log(`🔍 Total unique tweet articles found: ${allTweetArticles.length}`);

  const tweets = [];
  const retweets = [];
  const seenTweetIds = new Set();

  allTweetArticles.forEach((articleElement, index) => {
    // Try multiple ways to find the tweet link
    const linkSelectors = [
      'a[href*="/status/"]',
      'a[href*="/' + profileUsername + '/status/"]',
      'a[data-testid="tweetText"]',
      'a[role="link"]',
    ];

    let links = [];
    for (const linkSelector of linkSelectors) {
      const found = Array.from(articleElement.querySelectorAll(linkSelector));
      links = [...links, ...found];
    }

    // Remove duplicate links
    links = [...new Set(links)];

    // Check if this is a retweet by looking for retweet indicators FIRST
    const retweetSelectors = [
      '[data-testid="socialContext"]',
      '[data-testid="retweet"]',
      'div[data-testid="retweet"]',
      'span[data-testid="retweet"]',
      'span:contains("Reposteaste")',
      'span:contains("Retweeted")',
    ];

    let isRetweet = false;
    for (const retweetSelector of retweetSelectors) {
      if (articleElement.querySelector(retweetSelector)) {
        isRetweet = true;
        break;
      }
    }

    // Also check for retweet text in Spanish and English
    const retweetText = articleElement.innerText || '';
    if (retweetText.includes('Reposteaste') || retweetText.includes('Retweeted')) {
      isRetweet = true;
    }

    // For retweets, look for any status link (not just your username)
    // For regular tweets, look for your username in the URL
    let permalink;
    if (isRetweet) {
      permalink = links.find(
        (a) => a.href && a.href.includes('/status/') && a.querySelector('time')
      );
    } else {
      permalink = links.find(
        (a) => a.href && a.href.includes(`/${profileUsername}/status/`) && a.querySelector('time')
      );
    }

    if (!permalink) {
      // Try to find any status link in this article
      const anyStatusLink = links.find((a) => a.href && a.href.includes('/status/'));
      if (anyStatusLink) {
        console.log(`⚠️  Found status link but not for ${profileUsername}: ${anyStatusLink.href}`);
      }
      return;
    }

    const tweetId = permalink.href.match(/\/status\/(\d+)/)?.[1];
    if (!tweetId || seenTweetIds.has(tweetId)) {
      return;
    }

    seenTweetIds.add(tweetId);

    // Try multiple ways to get tweet text
    const textSelectors = [
      '[data-testid="tweetText"]',
      '[data-testid="tweet"] span',
      'div[lang]',
      'span[dir="ltr"]',
    ];

    let tweetContent = '[No text content]';
    for (const textSelector of textSelectors) {
      const textElement = articleElement.querySelector(textSelector);
      if (textElement && textElement.innerText && textElement.innerText.trim()) {
        tweetContent = textElement.innerText.trim();
        break;
      }
    }

    if (isRetweet) {
      console.log(`🔄 Found your retweet ${tweetId} - "${tweetContent.substring(0, 50)}..."`);
      retweets.push({ id: tweetId, content: tweetContent });
    } else {
      console.log(`✅ Found your tweet ${tweetId} - "${tweetContent.substring(0, 50)}..."`);
      tweets.push({ id: tweetId, content: tweetContent });
    }
  });

  console.log(`📊 Summary: ${tweets.length} tweets, ${retweets.length} retweets found`);
  return { tweets, retweets };
}

async function autoDeleteAllTweets() {
  const profileUsername = window.location.pathname.split('/')[1];
  let totalDeleted = 0;
  let totalRetweetsDeleted = 0;

  async function deleteTweet(tweetId, content) {
    try {
      const response = await fetch(
        'https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet',
        {
          method: 'POST',
          headers: headers,
          credentials: 'include',
          body: JSON.stringify({
            variables: {
              tweet_id: tweetId,
              dark_request: false,
            },
            queryId: 'VaenaVgh5q5ih7kvyVjgtg',
          }),
        }
      );

      if (response.ok) {
        console.log(`✅ Deleted tweet ${tweetId}`);
        console.log(`📝 Content: "${content}"`);
        totalDeleted++;

        // Remove the tweet element from DOM
        const tweetElement = document
          .querySelector(`article[data-testid="tweet"] a[href*="/status/${tweetId}"]`)
          ?.closest('article');
        if (tweetElement) {
          tweetElement.remove();
        }

        return true;
      } else {
        console.log(`❌ Failed to delete tweet ${tweetId}: ${response.status}`);
        console.log(`📝 Content: "${content}"`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Error deleting tweet ${tweetId}:`, error);
      console.log(`📝 Content: "${content}"`);
      return false;
    }
  }

  async function deleteRetweet(tweetId, content) {
    try {
      const response = await fetch(
        'https://x.com/i/api/graphql/iQtK4dl5hBmXewYZuEOKVw/DeleteRetweet',
        {
          method: 'POST',
          headers: headers,
          credentials: 'include',
          body: JSON.stringify({
            variables: {
              source_tweet_id: tweetId,
              dark_request: false,
            },
            queryId: 'iQtK4dl5hBmXewYZuEOKVw',
          }),
        }
      );

      if (response.ok) {
        console.log(`🔄 Deleted retweet ${tweetId}`);
        console.log(`📝 Content: "${content}"`);
        totalRetweetsDeleted++;

        // Remove the retweet element from DOM
        const retweetElement = document
          .querySelector(`article[data-testid="tweet"] a[href*="/status/${tweetId}"]`)
          ?.closest('article');
        if (retweetElement) {
          retweetElement.remove();
        }

        return true;
      } else {
        console.log(`❌ Failed to delete retweet ${tweetId}: ${response.status}`);
        console.log(`📝 Content: "${content}"`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Error deleting retweet ${tweetId}:`, error);
      console.log(`📝 Content: "${content}"`);
      return false;
    }
  }

  async function scrollAndWait() {
    console.log('📜 Scrolling to bottom...');
    window.scrollTo(0, document.body.scrollHeight);
    console.log('⏳ Waiting 3 seconds for content to load...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.log(`🚀 Starting auto-delete for @${profileUsername}`);

  // Initial scroll and wait
  await scrollAndWait();

  let consecutiveEmptyChecks = 0;
  const maxEmptyChecks = 3; // Try 3 times before giving up

  while (true) {
    // Sniff all our tweets and retweets
    const { tweets, retweets } = getMyTweetIds();
    console.log(
      `🔍 Found ${tweets.length} of my tweets and ${retweets.length} of my retweets visible`
    );

    if (tweets.length === 0 && retweets.length === 0) {
      consecutiveEmptyChecks++;
      console.log(
        `🔄 No tweets visible (attempt ${consecutiveEmptyChecks}/${maxEmptyChecks}), trying to load more...`
      );

      // Try scrolling multiple times
      for (let scrollAttempt = 1; scrollAttempt <= 2; scrollAttempt++) {
        console.log(`📜 Scroll attempt ${scrollAttempt}/2...`);
        await scrollAndWait();

        // Check after each scroll
        const itemsAfterScroll = getMyTweetIds();
        if (itemsAfterScroll.tweets.length > 0 || itemsAfterScroll.retweets.length > 0) {
          console.log(
            `📥 Loaded ${itemsAfterScroll.tweets.length} more tweets and ${itemsAfterScroll.retweets.length} more retweets`
          );
          consecutiveEmptyChecks = 0; // Reset counter
          break;
        }
      }

      // If we still have no items after multiple scrolls
      const finalCheck = getMyTweetIds();
      if (finalCheck.tweets.length === 0 && finalCheck.retweets.length === 0) {
        if (consecutiveEmptyChecks >= maxEmptyChecks) {
          console.log(
            '🎉 No more tweets or retweets found after multiple attempts. Script complete!'
          );
          break;
        }
        console.log(`⏳ Waiting 5 seconds before next attempt...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
    } else {
      consecutiveEmptyChecks = 0; // Reset counter when we find items
    }

    // Delete retweets first (they might be easier to delete)
    for (let i = 0; i < retweets.length; i++) {
      const retweet = retweets[i];
      console.log(`🔄 Deleting retweet ${i + 1}/${retweets.length}: ${retweet.id}`);

      await deleteRetweet(retweet.id, retweet.content);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second between deletions
    }

    // Delete regular tweets
    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      console.log(`🗑️  Deleting tweet ${i + 1}/${tweets.length}: ${tweet.id}`);

      await deleteTweet(tweet.id, tweet.content);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second between deletions
    }

    console.log(
      `✨ Batch complete. Total deleted: ${totalDeleted} tweets, ${totalRetweetsDeleted} retweets`
    );
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Brief pause before checking again
  }

  console.log(
    `🏁 Finished! Total tweets deleted: ${totalDeleted}, total retweets deleted: ${totalRetweetsDeleted}`
  );
}

// Run this to start:
autoDeleteAllTweets();

// Manual check function - run this to see what tweets are currently visible:
function checkCurrentTweets() {
  console.log('🔍 Manual check of current tweets...');
  const { tweets, retweets } = getMyTweetIds();
  console.log(`📊 Current page has ${tweets.length} tweets and ${retweets.length} retweets`);

  if (tweets.length > 0) {
    console.log('📝 Tweets found:');
    tweets.forEach((tweet, index) => {
      console.log(`  ${index + 1}. ID: ${tweet.id} - "${tweet.content.substring(0, 100)}..."`);
    });
  }

  if (retweets.length > 0) {
    console.log('🔄 Retweets found:');
    retweets.forEach((retweet, index) => {
      console.log(`  ${index + 1}. ID: ${retweet.id} - "${retweet.content.substring(0, 100)}..."`);
    });
  }

  return { tweets, retweets };
}

// Run this to manually check what's on the page:
checkCurrentTweets();
