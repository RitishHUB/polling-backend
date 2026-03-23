import express from 'express';
import {
    createPoll,
    getPolls,
    getPollById,
    votePoll,
    editPoll,
    deletePoll,
    getPollResults,
    getAIAnalysis,
    getRecommendedPolls,
    getPollForecast
} from '../controllers/pollController.js';
import { protect, admin, staffOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getPolls)
    .post(protect, staffOrAdmin, createPoll);

// ML Recommendations — must be BEFORE /:id routes
router.route('/recommendations')
    .get(protect, getRecommendedPolls);

router.route('/:id')
    .get(protect, getPollById)
    .put(protect, staffOrAdmin, editPoll)
    .delete(protect, admin, deletePoll);

router.route('/:id/results')
    .get(protect, staffOrAdmin, getPollResults);

router.route('/:id/vote')
    .post(protect, votePoll);

// AI Analysis
router.route('/:id/ai-analysis')
    .get(protect, staffOrAdmin, getAIAnalysis);

// Vote Forecast + Anomaly Detection
router.route('/:id/forecast')
    .get(protect, staffOrAdmin, getPollForecast);

export default router;
