import express from 'express';
import {
    createPoll,
    getPolls,
    getPollById,
    votePoll,
    deletePoll,
    getPollResults
} from '../controllers/pollController.js';
import { protect, admin, staffOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getPolls)
    .post(protect, staffOrAdmin, createPoll);

router.route('/:id')
    .get(protect, getPollById)
    .delete(protect, admin, deletePoll);

router.route('/:id/results')
    .get(protect, staffOrAdmin, getPollResults);

router.route('/:id/vote')
    .post(protect, votePoll);

export default router;
