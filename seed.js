import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './models/User.js';

dotenv.config();

const MONGO_URI = 'mongodb+srv://loguritish28_db_user:uuZviPoBo1AoxoQ0@cluster0.bi95ca8.mongodb.net/polling?retryWrites=true&w=majority';

const importData = async () => {
    try {
        await mongoose.connect(MONGO_URI);

        // Wipe existing users before seeding to prevent duplicates
        await User.deleteMany();

        const createdUsers = await User.create([
            {
                name: "Admin",
                email: "admin@college.com",
                password: "admin123", // Pre-save hook hashes this automatically
                role: "Admin",
            },
            {
                name: "Staff Demo",
                email: "staff@college.com",
                password: "staff123",
                role: "Staff",
                department: "Computer Science"
            },
            {
                name: "Student Demo",
                email: "student@college.com",
                password: "student123",
                role: "Student"
            }
        ]);

        console.log(`✅ Data Imported! Created ${createdUsers.length} initial users.`);
        process.exit();
    } catch (error) {
        console.error(`❌ Error importing data: ${error}`);
        process.exit(1);
    }
};

importData();
