/**
 * AI-Powered Sentiment Analysis Engine
 * Uses lexicon-based NLP, TF-IDF keyword extraction, and engagement prediction.
 * Pure JavaScript — no external ML libraries.
 */

// Curated sentiment lexicons
const POSITIVE_WORDS = new Set([
  'good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful',
  'best', 'love', 'like', 'happy', 'joy', 'brilliant', 'outstanding', 'perfect',
  'improve', 'improvement', 'better', 'success', 'successful', 'benefit',
  'beneficial', 'positive', 'exciting', 'excited', 'helpful', 'support',
  'innovative', 'innovation', 'creative', 'opportunity', 'opportunities',
  'progress', 'advance', 'advanced', 'enhance', 'enhanced', 'upgrade',
  'efficient', 'effective', 'recommend', 'recommended', 'preferred', 'prefer',
  'favorite', 'favourite', 'celebrate', 'celebration', 'win', 'winning',
  'achieve', 'achievement', 'reward', 'rewarding', 'fun', 'enjoy', 'enjoyable',
  'pleasant', 'pleased', 'satisfy', 'satisfied', 'satisfaction', 'comfortable',
  'convenient', 'convenience', 'safe', 'safety', 'secure', 'clean', 'modern',
  'new', 'fresh', 'smart', 'intelligent', 'fast', 'quick', 'easy', 'simple',
  'free', 'quality', 'premium', 'top', 'leading', 'popular', 'trusted',
  'reliable', 'strong', 'powerful', 'beautiful', 'elegant', 'smooth', 'fair',
  'friendly', 'warm', 'welcome', 'welcoming', 'open', 'inclusive', 'diverse',
  'collaborative', 'teamwork', 'together', 'community', 'growth', 'grow',
  'develop', 'development', 'learn', 'learning', 'educate', 'education',
  'knowledge', 'skill', 'talent', 'gifted', 'inspire', 'inspired', 'inspiring',
  'motivate', 'motivated', 'motivation', 'encourage', 'encouraged', 'encouraging'
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'worst', 'terrible', 'horrible', 'awful', 'poor', 'hate', 'dislike',
  'sad', 'angry', 'frustrating', 'frustrated', 'disappointing', 'disappointed',
  'fail', 'failure', 'problem', 'problems', 'issue', 'issues', 'concern',
  'concerned', 'worry', 'worried', 'fear', 'danger', 'dangerous', 'risk',
  'risky', 'threat', 'threatening', 'damage', 'damaged', 'harm', 'harmful',
  'negative', 'decline', 'decrease', 'reduce', 'reduced', 'loss', 'lose',
  'losing', 'waste', 'wasted', 'expensive', 'costly', 'slow', 'difficult',
  'hard', 'complex', 'complicated', 'confusing', 'confused', 'unclear',
  'unfair', 'unjust', 'wrong', 'error', 'mistake', 'broken', 'outdated',
  'old', 'boring', 'dull', 'ugly', 'dirty', 'unsafe', 'insecure', 'weak',
  'corrupt', 'corruption', 'abuse', 'neglect', 'ignore', 'ignored', 'reject',
  'rejected', 'complaint', 'complain', 'protest', 'oppose', 'opposition',
  'conflict', 'crisis', 'emergency', 'urgent', 'critical', 'severe',
  'shortage', 'lacking', 'insufficient', 'inadequate', 'overcrowded',
  'noisy', 'pollution', 'toxic', 'stress', 'stressful', 'burden', 'overload',
  'delay', 'delayed', 'cancel', 'cancelled', 'restrict', 'restricted',
  'ban', 'banned', 'penalty', 'punish', 'punishment', 'fine', 'charge'
]);

const INTENSIFIERS = new Set([
  'very', 'extremely', 'incredibly', 'absolutely', 'totally', 'completely',
  'highly', 'deeply', 'strongly', 'significantly', 'remarkably', 'exceptionally'
]);

const NEGATORS = new Set([
  'not', 'no', 'never', 'neither', 'nor', 'none', 'nothing', 'nowhere',
  'hardly', 'barely', 'scarcely', 'without', "don't", "doesn't", "didn't",
  "won't", "wouldn't", "shouldn't", "couldn't", "isn't", "aren't", "wasn't"
]);

// Common English stop words for TF-IDF
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while',
  'about', 'up', 'its', 'it', 'this', 'that', 'these', 'those', 'i',
  'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she',
  'her', 'they', 'them', 'their', 'what', 'which', 'who', 'whom'
]);

/**
 * Tokenize text into lowercase word array
 */
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(w => w.length > 1);
}

/**
 * Calculate sentiment score for a text string
 * Returns { score: -1..1, positive: count, negative: count, details: [] }
 */
function scoreSentiment(text) {
  const tokens = tokenize(text);
  let score = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  const details = [];

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const prevWord = i > 0 ? tokens[i - 1] : '';
    const isNegated = NEGATORS.has(prevWord);
    const isIntensified = INTENSIFIERS.has(prevWord);
    const multiplier = isIntensified ? 1.5 : 1;

    if (POSITIVE_WORDS.has(word)) {
      if (isNegated) {
        score -= 0.5 * multiplier;
        negativeCount++;
        details.push({ word, effect: 'negated_positive', value: -0.5 * multiplier });
      } else {
        score += 1 * multiplier;
        positiveCount++;
        details.push({ word, effect: 'positive', value: 1 * multiplier });
      }
    } else if (NEGATIVE_WORDS.has(word)) {
      if (isNegated) {
        score += 0.5 * multiplier;
        positiveCount++;
        details.push({ word, effect: 'negated_negative', value: 0.5 * multiplier });
      } else {
        score -= 1 * multiplier;
        negativeCount++;
        details.push({ word, effect: 'negative', value: -1 * multiplier });
      }
    }
  }

  const totalSentiWords = positiveCount + negativeCount;
  const normalizedScore = totalSentiWords > 0 ? score / totalSentiWords : 0;

  return {
    score: Math.max(-1, Math.min(1, normalizedScore)),
    positive: positiveCount,
    negative: negativeCount,
    details
  };
}

/**
 * TF-IDF Keyword Extraction
 * Extracts top keywords from a corpus of text segments
 */
function extractKeywords(texts, topN = 8) {
  const allTokens = texts.map(t => tokenize(t));

  // Term Frequency per document
  const tfDocs = allTokens.map(tokens => {
    const freq = {};
    tokens.forEach(t => {
      if (!STOP_WORDS.has(t) && t.length > 2) {
        freq[t] = (freq[t] || 0) + 1;
      }
    });
    // Normalize
    const maxFreq = Math.max(...Object.values(freq), 1);
    Object.keys(freq).forEach(k => { freq[k] /= maxFreq; });
    return freq;
  });

  // Inverse Document Frequency
  const docCount = tfDocs.length || 1;
  const idf = {};
  const allTerms = new Set();
  tfDocs.forEach(doc => Object.keys(doc).forEach(t => allTerms.add(t)));

  allTerms.forEach(term => {
    const docsContaining = tfDocs.filter(doc => doc[term]).length;
    idf[term] = Math.log((docCount + 1) / (docsContaining + 1)) + 1;
  });

  // TF-IDF scores (aggregate across all docs)
  const tfidf = {};
  tfDocs.forEach(doc => {
    Object.entries(doc).forEach(([term, tf]) => {
      tfidf[term] = (tfidf[term] || 0) + tf * (idf[term] || 1);
    });
  });

  return Object.entries(tfidf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, score]) => ({ word, relevance: Math.round(score * 100) / 100 }));
}

/**
 * Predict engagement level based on poll characteristics
 */
function predictEngagement(poll) {
  let engagementScore = 50; // baseline
  const factors = [];

  // Title analysis
  if (poll.title.includes('?')) {
    engagementScore += 12;
    factors.push('Question-based title boosts curiosity (+12)');
  }
  if (poll.title.length > 10 && poll.title.length < 60) {
    engagementScore += 8;
    factors.push('Optimal title length for engagement (+8)');
  }

  // Description richness
  if (poll.description && poll.description.length > 30) {
    engagementScore += 10;
    factors.push('Detailed description increases participation (+10)');
  }

  // Option count sweet spot (3-5 is ideal)
  const optCount = poll.options?.length || 0;
  if (optCount >= 3 && optCount <= 5) {
    engagementScore += 15;
    factors.push(`Ideal option count (${optCount}) increases decision engagement (+15)`);
  } else if (optCount === 2) {
    engagementScore += 5;
    factors.push('Binary choice — quick but lower engagement (+5)');
  } else if (optCount > 5) {
    engagementScore -= 5;
    factors.push('Too many options may cause decision fatigue (-5)');
  }

  // Category boost
  if (poll.category === 'Urgent') {
    engagementScore += 15;
    factors.push('Urgent category drives immediate action (+15)');
  } else if (poll.category === 'Events') {
    engagementScore += 10;
    factors.push('Event-related polls see high participation (+10)');
  }

  // Visibility
  if (poll.visibility === 'Both') {
    engagementScore += 8;
    factors.push('Broad visibility maximizes reach (+8)');
  }

  // Anonymous polls encourage participation
  if (poll.anonymous) {
    engagementScore += 10;
    factors.push('Anonymous voting reduces social pressure (+10)');
  }

  // Live results drive FOMO
  if (poll.allowLiveResults) {
    engagementScore += 7;
    factors.push('Live results create FOMO engagement (+7)');
  }

  engagementScore = Math.min(100, Math.max(0, engagementScore));

  let level = 'Low';
  if (engagementScore >= 75) level = 'Very High';
  else if (engagementScore >= 60) level = 'High';
  else if (engagementScore >= 40) level = 'Moderate';

  return { score: engagementScore, level, factors };
}

/**
 * Main analysis function — combine all AI analyses
 */
export function analyzeSentiment(poll) {
  // Combine all text for analysis
  const titleSentiment = scoreSentiment(poll.title);
  const descSentiment = scoreSentiment(poll.description || '');
  const optionTexts = (poll.options || []).map(o => o.optionText || '');
  const optionSentiments = optionTexts.map(t => scoreSentiment(t));

  // Overall weighted sentiment (title has 2x weight)
  const allScores = [
    titleSentiment.score * 2,
    descSentiment.score,
    ...optionSentiments.map(s => s.score)
  ];
  const overallScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;

  let overallSentiment = 'Neutral';
  if (overallScore > 0.2) overallSentiment = 'Positive';
  else if (overallScore > 0.5) overallSentiment = 'Very Positive';
  else if (overallScore < -0.2) overallSentiment = 'Negative';
  else if (overallScore < -0.5) overallSentiment = 'Very Negative';

  // Extract keywords from all text
  const allTexts = [poll.title, poll.description || '', ...optionTexts];
  const keywords = extractKeywords(allTexts);

  // Engagement prediction
  const engagement = predictEngagement(poll);

  // Option-level analysis
  const optionAnalysis = (poll.options || []).map((opt, i) => ({
    optionText: opt.optionText,
    sentiment: optionSentiments[i]?.score > 0.1 ? 'Positive' :
               optionSentiments[i]?.score < -0.1 ? 'Negative' : 'Neutral',
    sentimentScore: Math.round((optionSentiments[i]?.score || 0) * 100) / 100
  }));

  return {
    overallSentiment,
    sentimentScore: Math.round(overallScore * 100) / 100,
    sentimentBreakdown: {
      title: { sentiment: titleSentiment.score > 0.1 ? 'Positive' : titleSentiment.score < -0.1 ? 'Negative' : 'Neutral', score: Math.round(titleSentiment.score * 100) / 100 },
      description: { sentiment: descSentiment.score > 0.1 ? 'Positive' : descSentiment.score < -0.1 ? 'Negative' : 'Neutral', score: Math.round(descSentiment.score * 100) / 100 }
    },
    keywords,
    engagementPrediction: engagement,
    optionAnalysis
  };
}
