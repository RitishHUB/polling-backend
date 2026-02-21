import User from '../models/User.js';
import Poll from '../models/Poll.js';
import Vote from '../models/Vote.js';
import Badge from '../models/Badge.js';

// @desc    Get dashboard stats for Admin
// @route   GET /api/users/admin/stats
// @access  Private/Admin
export const getAdminStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalPolls = await Poll.countDocuments();
        const totalVotes = await Vote.countDocuments();

        res.json({ totalUsers, totalPolls, totalVotes });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            if (user.role === 'Admin') {
                return res.status(400).json({ message: 'Cannot delete admin user' });
            }
            await user.deleteOne();
            res.json({ message: 'User removed' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get student dashboard data (Badges, Voting History, active polls)
// @route   GET /api/users/student/dashboard
// @access  Private
export const getStudentDashboard = async (req, res) => {
    try {
        const badges = await Badge.find({ userId: req.user._id });

        // Find votes cast by this user
        const votes = await Vote.find({ userId: req.user._id }).populate('pollId', 'title description endTime startTime options');

        res.json({ badges, votes });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.department = req.body.department || user.department;
            user.rollNumber = req.body.rollNumber || user.rollNumber;
            user.profilePic = req.body.profilePic || user.profilePic;

            if (req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                department: updatedUser.department,
                rollNumber: updatedUser.rollNumber,
                profilePic: updatedUser.profilePic,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
