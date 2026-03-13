const Translation = require('../models/Translation');
const { translateText } = require('./googleTranslation');

// In-memory cache with TTL
const memoryCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Function to detect if text is already in the target language
const isAlreadyInTargetLanguage = (text, targetLanguage) => {
    if (!text || typeof text !== 'string') return false;
    return targetLanguage === 'ar' ? /[\u0600-\u06FF]/.test(text) : false;
};

// Function to clean up duplicate translations
const cleanupDuplicates = async () => {
    try {
        const duplicates = await Translation.aggregate([
            {
                $group: {
                    _id: { originalText: "$originalText", targetLanguage: "$targetLanguage" },
                    count: { $sum: 1 },
                    docs: { $push: "$_id" }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        for (const duplicate of duplicates) {
            const [keep, ...remove] = duplicate.docs;
            await Translation.deleteMany({ _id: { $in: remove } });
        }
    } catch (error) {
        console.error('Error during duplicate cleanup:', error);
    }
};

// Function to get translation with caching
const getTranslation = async (originalText, targetLanguage) => {
    try {
        if (!originalText || !targetLanguage) return originalText;

        // Check if text is already in target language
        if (isAlreadyInTargetLanguage(originalText, targetLanguage)) {
            return originalText;
        }

        // Check memory cache first
        const cacheKey = `${originalText}:${targetLanguage}`;
        const cachedData = memoryCache.get(cacheKey);
        if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
            return cachedData.translation;
        }

        // Check database cache
        const cachedTranslation = await Translation.findOne({
            originalText,
            targetLanguage
        });

        if (cachedTranslation) {
            memoryCache.set(cacheKey, {
                translation: cachedTranslation.translatedText,
                timestamp: Date.now()
            });
            return cachedTranslation.translatedText;
        }

        // Manual only: do not use Google Translate, just return original text if not found
        return originalText;
    } catch (error) {
        console.error('Translation error:', error);
        return originalText;
    }
};

module.exports = {
    getTranslation
}; 