import express from 'express';
import authController from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/me', protect, authController.getMe);
router.patch('/me', protect, authController.updateMe);
router.patch('/update-password', protect, authController.updatePassword);
router.post('/logout', protect, authController.logout);

export default router;
