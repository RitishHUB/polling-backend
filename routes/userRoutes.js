import express from 'express';
import {
    getAdminStats,
    getUsers,
    deleteUser,
    getStudentDashboard,
    updateUserProfile
} from '../controllers/userController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/profile')
    .put(protect, updateUserProfile);

router.route('/')
    .get(protect, admin, getUsers);

router.route('/:id')
    .delete(protect, admin, deleteUser);

router.route('/admin/stats')
    .get(protect, admin, getAdminStats);

router.route('/student/dashboard')
    .get(protect, getStudentDashboard);

export default router;
