/**
 * Offline / Database Fallback Model
 * 
 * Provides dynamic database recommendations when the cloud LLM is offline,
 * and avoids static hardcoded template responses.
 */

import { query } from '../../db.js';

export async function runFallback({ message, locale = 'en', intent = 'general', context }) {
  if (intent === 'doctor') {
    try {
      const msgLower = message.toLowerCase();
      let specialty = '';
      if (msgLower.includes('gyn')) {
        specialty = 'Gynecologist';
      } else if (msgLower.includes('pediatr') || msgLower.includes('paediatr') || msgLower.includes('child') || msgLower.includes('baby')) {
        specialty = 'Pediatrician';
      } else if (msgLower.includes('nutrition') || msgLower.includes('diet')) {
        specialty = 'Nutritionist';
      } else if (msgLower.includes('pharmac')) {
        specialty = 'Pharmacist';
      }

      let sql = `
        SELECT d.full_name, d.specialization, d.hospital, d.location, d.experience_years, d.phone, d.email, d.fee_amount, d.rating, d.availability_status, s.name AS specialty_name 
        FROM doctors d 
        LEFT JOIN doctor_specialties s ON d.specialty_id = s.id 
        WHERE d.verified = TRUE
      `;
      let params = [];
      if (specialty) {
        sql += ` AND (s.name LIKE ? OR d.specialization LIKE ?)`;
        params.push(`%${specialty}%`, `%${specialty}%`);
      }
      sql += ` LIMIT 5`;

      const doctors = await query(sql, params);

      if (doctors && doctors.length > 0) {
        let text = locale === 'bn'
          ? `**যাচাইকৃত ডাক্তারদের তালিকা**\n\nআপনার জন্য কিছু বিশেষজ্ঞ ডাক্তারের তথ্য নিচে দেওয়া হলো:\n\n`
          : `**Verified Doctor Recommendations**\n\nHere are some qualified specialists recommended for you:\n\n`;

        doctors.forEach((doc) => {
          const ratingStar = doc.rating ? `⭐ ${Number(doc.rating).toFixed(1)}` : 'N/A';
          const fee = doc.fee_amount ? `${doc.fee_amount} BDT` : 'N/A';
          const exp = doc.experience_years ? `${doc.experience_years} years` : 'N/A';
          const hospital = doc.hospital || doc.location || 'N/A';
          const spec = doc.specialization || doc.specialty_name || 'Specialist';
          
          text += `### **${doc.full_name}** (${spec})\n`;
          text += `- **Hospital/Location:** ${hospital}\n`;
          text += `- **Experience:** ${exp} | **Rating:** ${ratingStar}\n`;
          text += `- **Consultation Fee:** ${fee}\n`;
          text += `- **Status:** ${doc.availability_status || 'Available'}\n`;
          text += `- **Contact:** ${doc.email || doc.phone || 'N/A'}\n\n`;
        });

        text += locale === 'bn'
          ? `*ডাক্তার বুকিং করতে বা পুরো সিডিউল দেখতে অনুগ্রহ করে প্রধান পোর্টালের "ডাক্তার" সেকশনে যান।*`
          : `*To book a consultation slot, please navigate to the Doctors directory in the main portal.*`;

        return {
          text,
          modelUsed: 'fallback-database',
          sources: [],
          riskLevel: undefined
        };
      } else {
        const noDocsMsg = locale === 'bn'
          ? `দুঃখিত, এই মুহূর্তে কোনো বিশেষজ্ঞ ডাক্তার পাওয়া যায়নি। অনুগ্রহ করে প্রধান পোর্টালের ডাক্তার সেকশনে দেখুন।`
          : `I couldn't find any matching verified doctors in the database at the moment. Please visit the Doctors directory on the main portal.`;
        return {
          text: noDocsMsg,
          modelUsed: 'fallback',
          sources: [],
          riskLevel: undefined
        };
      }
    } catch (err) {
      console.error('[AI Fallback] Failed to fetch doctors:', err.message);
    }
  }

  throw new Error('AI service is offline (no static fallback configured)');
}
