/**
 * Offline / Template-based Fallback Model
 * 
 * This model provides intelligent, context-aware responses when all cloud AI
 * models (GPT-4, BioGPT) are unavailable. It uses a curated knowledge base
 * of maternal health information to answer common pregnancy-related questions.
 * 
 * Guarantees: Every question gets a meaningful answer — no 503 errors.
 */

import { query } from '../../db.js';

const knowledgeBase = {
  en: {
    'mental-health': {
      responses: [
        {
          keywords: ['anxiety', 'anxious', 'worried', 'worry', 'nervous'],
          text: `**Anxiety During Pregnancy**\n\nFeeling anxious during pregnancy is very common and affects many expecting mothers.\n\n**Guidance:**\n- Practice deep breathing exercises (4-7-8 technique: inhale 4s, hold 7s, exhale 8s)\n- Maintain a regular sleep schedule and gentle exercise routine\n- Talk to your partner, family, or a trusted friend about your feelings\n- Consider prenatal yoga or meditation apps designed for pregnancy\n\n**When to seek help:** If anxiety interferes with daily activities, sleep, or eating, please speak with your healthcare provider. They can offer safe therapeutic options.\n\nWould you like tips on specific relaxation techniques?`
        },
        {
          keywords: ['stress', 'overwhelm', 'overwhelmed', 'tired', 'exhausted'],
          text: `**Managing Stress in Pregnancy**\n\nStress is a natural part of pregnancy, but managing it is important for both you and your baby.\n\n**Guidance:**\n- Break tasks into smaller, manageable steps\n- Delegate household chores when possible\n- Take short 10-15 minute rest breaks throughout the day\n- Stay connected with your support network\n\n**When to seek help:** If you feel constantly overwhelmed or unable to cope, talk to your doctor. Chronic stress can affect pregnancy outcomes.\n\nWhat specific aspect of your pregnancy is causing the most stress?`
        },
        {
          keywords: ['sad', 'depress', 'depression', 'crying', 'cry', 'lonely', 'alone'],
          text: `**Emotional Well-being During Pregnancy**\n\nHormonal changes can significantly affect your mood. Feeling sad or tearful is not uncommon.\n\n**Guidance:**\n- Maintain social connections — even brief phone calls help\n- Engage in activities you enjoy, even in small doses\n- Ensure you're getting adequate nutrition and sleep\n- Keep a mood journal to track patterns\n\n**When to seek urgent help:** If you experience persistent sadness lasting more than 2 weeks, loss of interest in activities, or thoughts of self-harm, please contact your healthcare provider immediately or call a crisis helpline.\n\nWould you like information about prenatal mental health resources?`
        },
        {
          keywords: ['panic', 'attack', 'fear', 'scared'],
          text: `**Managing Panic and Fear**\n\nPanic attacks and intense fear during pregnancy are more common than many realize.\n\n**Guidance:**\n- During a panic attack: focus on slow, steady breathing\n- Ground yourself using the 5-4-3-2-1 technique (5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste)\n- Avoid caffeine and sugar spikes which can worsen anxiety\n- Regular gentle exercise helps regulate stress hormones\n\n**When to seek help:** If panic attacks are frequent or severe, medication and therapy options safe for pregnancy are available.\n\nWould you like to learn more about grounding techniques?`
        }
      ],
      default: `**Mental Health Support**\n\nYour emotional well-being is just as important as your physical health during pregnancy.\n\n**Guidance:**\n- Practice mindfulness or guided meditation (even 5 minutes daily helps)\n- Stay physically active with pregnancy-safe exercises\n- Communicate openly with your support system\n- Maintain a consistent daily routine\n\n**When to seek help:** If emotional challenges persist or worsen, please reach out to your healthcare provider. There are many safe and effective treatments available during pregnancy.\n\nWhat specific emotional concern would you like to discuss?`
    },
    nutrition: {
      responses: [
        {
          keywords: ['food', 'eat', 'diet', 'meal', 'hungry'],
          text: `**Pregnancy Nutrition Guide**\n\nA balanced diet supports your baby's development and your well-being.\n\n**Key recommendations:**\n- Eat 5-6 small meals instead of 3 large ones\n- Include protein-rich foods: lean meat, eggs, beans, tofu\n- Add colorful fruits and vegetables for vitamins and fiber\n- Choose whole grains over refined options\n\n**Foods to limit:** Raw fish, unpasteurized dairy, high-mercury fish, excessive caffeine (limit to 200mg/day).\n\nWould you like meal plan ideas for your trimester?`
        },
        {
          keywords: ['vitamin', 'supplement', 'folic', 'folate', 'iron', 'calcium'],
          text: `**Essential Pregnancy Vitamins & Supplements**\n\n**Key nutrients:**\n- **Folic acid** (400-800 mcg/day): Critical for neural tube development, especially in first trimester\n- **Iron** (27 mg/day): Supports increased blood volume; take with vitamin C for better absorption\n- **Calcium** (1000 mg/day): Essential for baby's bone development\n- **Vitamin D** (600 IU/day): Supports calcium absorption and immune function\n- **DHA/Omega-3**: Supports baby's brain development\n\n**When to seek help:** If you experience severe nausea preventing vitamin intake, consult your provider about alternatives.\n\nAre you currently taking prenatal vitamins?`
        },
        {
          keywords: ['water', 'hydration', 'drink', 'fluid', 'thirst'],
          text: `**Staying Hydrated During Pregnancy**\n\nProper hydration is essential for amniotic fluid, nutrient transport, and preventing complications.\n\n**Guidance:**\n- Aim for 8-12 glasses (64-96 oz) of water daily\n- Increase intake in hot weather or after exercise\n- Add fruit slices for flavor if plain water is unappealing\n- Monitor urine color — pale yellow indicates good hydration\n\n**Warning signs of dehydration:** Dark urine, dizziness, headache, dry mouth, reduced fetal movement.\n\nWould you like tips on managing fluid intake with nausea?`
        },
        {
          keywords: ['protein', 'meat', 'vegetarian', 'vegan'],
          text: `**Protein Needs During Pregnancy**\n\nProtein is crucial for your baby's growth, especially in the second and third trimesters.\n\n**Daily target:** 70-100g protein per day\n\n**Good sources:**\n- Animal: Lean chicken, fish (low mercury), eggs, Greek yogurt\n- Plant: Lentils, chickpeas, quinoa, tofu, nuts, seeds\n- Dairy: Milk, cheese, cottage cheese\n\n**For vegetarians/vegans:** Combine different plant proteins throughout the day to ensure complete amino acid intake. Consider B12 supplementation.\n\nWould you like specific high-protein recipe ideas?`
        }
      ],
      default: `**Nutrition During Pregnancy**\n\n**General guidelines:**\n- Eat a variety of fruits, vegetables, whole grains, and lean proteins\n- Take prenatal vitamins as prescribed\n- Stay well-hydrated (8-12 glasses of water daily)\n- Eat small, frequent meals to manage nausea and energy levels\n\n**Foods to avoid:** Raw/undercooked meat and eggs, unpasteurized products, high-mercury fish, alcohol.\n\nWhat specific nutrition question do you have?`
    },
    medical: {
      responses: [
        {
          keywords: ['nausea', 'morning sickness', 'vomit', 'throwing up', 'sick'],
          text: `**Managing Nausea & Morning Sickness**\n\nNausea affects up to 80% of pregnant women, usually peaking around weeks 8-12.\n\n**Guidance:**\n- Eat small, bland meals every 2-3 hours (crackers, toast, rice)\n- Ginger tea or ginger candies can help reduce nausea\n- Avoid strong odors and greasy foods\n- Stay hydrated with small, frequent sips\n- Vitamin B6 (25mg 3x daily) may help — ask your doctor\n\n**When to seek urgent care:** If you cannot keep any food or fluids down for 24+ hours, lose weight, or feel dizzy/faint, contact your provider immediately (this may be hyperemesis gravidarum).\n\nHow many weeks along are you?`
        },
        {
          keywords: ['pain', 'cramp', 'cramping', 'ache', 'hurt'],
          text: `**Understanding Pain & Cramping in Pregnancy**\n\nMild cramping can be normal as your uterus expands, but some types need attention.\n\n**Normal cramping:** Mild, resembles menstrual cramps, comes and goes, no bleeding.\n\n**Guidance:**\n- Rest and change positions\n- Use a warm (not hot) compress\n- Stay hydrated\n- Gentle stretching may help\n\n**Seek immediate care if you experience:**\n- Severe or one-sided pain\n- Cramping with bleeding\n- Pain with fever\n- Regular contractions before 37 weeks\n- Sharp, persistent abdominal pain\n\nCan you describe where the pain is located and how severe it is?`
        },
        {
          keywords: ['headache', 'head', 'migraine'],
          text: `**Headaches During Pregnancy**\n\nHeadaches are common, especially in the first and third trimesters.\n\n**Safe remedies:**\n- Rest in a dark, quiet room\n- Apply a cold compress to your forehead\n- Stay hydrated and eat regular meals\n- Acetaminophen (Tylenol) is generally safe — follow dosage guidelines\n- Avoid ibuprofen and aspirin unless directed by your doctor\n\n**Seek immediate care if:**\n- Headache is sudden and severe ("worst headache ever")\n- Accompanied by vision changes, swelling, or upper abdominal pain\n- Does not resolve with rest and hydration\n- Occurs after 20 weeks (may indicate preeclampsia)\n\nWhen did the headache start and is it different from your usual headaches?`
        },
        {
          keywords: ['bleed', 'bleeding', 'spotting', 'blood'],
          text: `**Bleeding During Pregnancy**\n\nSome spotting can be normal, but bleeding should always be reported to your healthcare provider.\n\n**First trimester:** Light spotting may occur during implantation. However, heavy bleeding needs evaluation.\n\n**Second/Third trimester:** Any bleeding should be evaluated promptly.\n\n**Guidance:**\n- Note the color (pink, red, brown), amount, and any associated symptoms\n- Rest and avoid strenuous activity\n- Do not use tampons — use a pad to track amount\n\n**Seek immediate care if:**\n- Heavy bleeding (soaking a pad in an hour)\n- Bleeding with severe pain or cramping\n- Bleeding with dizziness or fainting\n- Any bleeding after 20 weeks\n\nPlease contact your healthcare provider about any bleeding you're experiencing.`
        },
        {
          keywords: ['fever', 'temperature', 'hot', 'chills'],
          text: `**Fever During Pregnancy**\n\nA fever above 100.4°F (38°C) during pregnancy needs attention.\n\n**Immediate steps:**\n- Take acetaminophen (Tylenol) as directed\n- Rest and stay hydrated\n- Use a cool compress\n- Monitor your temperature regularly\n\n**When to seek care:**\n- Fever above 101°F (38.3°C)\n- Fever lasting more than 24 hours\n- Fever with rash, body aches, or urinary symptoms\n- Fever with reduced fetal movement\n\n**Important:** Avoid ibuprofen and aspirin. Persistent high fever can affect fetal development.\n\nHow high is your temperature, and do you have other symptoms?`
        },
        {
          keywords: ['preeclampsia', 'eclampsia', 'toxemia'],
          text: `**Understanding Preeclampsia**\n\nPreeclampsia is a serious pregnancy complication involving high blood pressure, usually after 20 weeks.\n\n**Warning signs:**\n- Blood pressure ≥ 140/90 mmHg\n- Severe headaches that don't resolve\n- Visual disturbances (blurred vision, seeing spots)\n- Upper abdominal pain (especially right side)\n- Sudden swelling of face and hands\n- Protein in urine\n\n**Risk factors:** First pregnancy, age over 35, obesity, multiple gestation, pre-existing hypertension, kidney disease.\n\n**Important:** Preeclampsia requires medical management. If you have any warning signs, contact your provider immediately.\n\nAre you experiencing any of these symptoms currently?`
        },
        {
          keywords: ['diabetes', 'gestational', 'glucose', 'sugar'],
          text: `**Gestational Diabetes**\n\nGestational diabetes affects about 6-9% of pregnancies and is typically screened between weeks 24-28.\n\n**Management:**\n- Monitor blood glucose as directed (typically fasting and post-meal)\n- Follow a balanced diet with controlled carbohydrate intake\n- Exercise regularly (30 min/day of moderate activity)\n- Take medication or insulin if prescribed\n\n**Target glucose levels:**\n- Fasting: < 95 mg/dL\n- 1 hour after meals: < 140 mg/dL\n- 2 hours after meals: < 120 mg/dL\n\n**When to seek help:** Consistently high readings, symptoms like excessive thirst, frequent urination, or blurred vision.\n\nHave you been screened for gestational diabetes?`
        },
        {
          keywords: ['vaccine', 'vaccination', 'immunization', 'shot', 'flu', 'covid', 'tdap'],
          text: `**Vaccines During Pregnancy**\n\n**Recommended vaccines:**\n- **Flu vaccine**: Safe in any trimester; protects you and baby\n- **Tdap** (whooping cough): Recommended between weeks 27-36 to pass antibodies to baby\n- **COVID-19 vaccine**: Safe and recommended during pregnancy\n- **RSV vaccine**: May be recommended between weeks 32-36\n\n**Vaccines to AVOID during pregnancy:**\n- MMR (measles, mumps, rubella)\n- Varicella (chickenpox)\n- Live-virus vaccines\n\n**When to get vaccinated:** Discuss specific timing with your provider at your next prenatal visit.\n\nWhich vaccine are you asking about?`
        },
        {
          keywords: ['medication', 'medicine', 'drug', 'tablet', 'pill', 'safe'],
          text: `**Medication Safety During Pregnancy**\n\n**Generally safe:**\n- Acetaminophen (Tylenol) for pain/fever\n- Prenatal vitamins\n- Most prescribed prenatal medications\n\n**Avoid unless directed by doctor:**\n- Ibuprofen (Advil/Motrin)\n- Aspirin (except low-dose if prescribed)\n- Many herbal supplements\n- Over-the-counter cold medications (check with pharmacist)\n\n**Important:** Never start, stop, or change medications without consulting your healthcare provider.\n\nWhat specific medication are you asking about?`
        }
      ],
      default: `**Medical Guidance**\n\nI can provide general information about common pregnancy symptoms and concerns.\n\n**Key reminders:**\n- Keep all prenatal appointments\n- Report any new or concerning symptoms to your provider\n- Don't hesitate to call your doctor — no question is too small\n- Keep an updated list of current medications\n\n**Seek immediate care for:** Heavy bleeding, severe abdominal pain, sudden severe headache, vision changes, reduced fetal movement, fluid leaking.\n\nWhat specific medical concern do you have?`
    },
    monitoring: {
      responses: [
        {
          keywords: ['blood pressure', 'bp', 'pressure', 'hypertension'],
          text: `**Blood Pressure Monitoring**\n\n**Normal range during pregnancy:** 90/60 to 120/80 mmHg\n\n**Categories:**\n- **Normal:** < 120/80\n- **Elevated:** 120-129 / <80\n- **Stage 1 Hypertension:** 130-139 / 80-89\n- **Stage 2 Hypertension:** ≥ 140/90\n- **Crisis:** ≥ 160/110 (seek immediate care)\n\n**Tips for accurate readings:**\n- Sit quietly for 5 minutes before measuring\n- Use the same arm each time\n- Don't cross legs\n- Measure at the same time daily\n\n**When to call your doctor:** Readings consistently above 140/90 or any sudden spike.\n\nWhat were your recent BP readings?`
        },
        {
          keywords: ['weight', 'gain', 'heavy', 'kg', 'pound'],
          text: `**Weight Monitoring During Pregnancy**\n\n**Recommended weight gain (total):**\n- Underweight (BMI < 18.5): 28-40 lbs (12.5-18 kg)\n- Normal weight (BMI 18.5-24.9): 25-35 lbs (11.5-16 kg)\n- Overweight (BMI 25-29.9): 15-25 lbs (7-11.5 kg)\n- Obese (BMI ≥ 30): 11-20 lbs (5-9 kg)\n\n**Typical pattern:**\n- First trimester: 1-5 lbs total\n- Second & third: about 1 lb per week\n\n**When to be concerned:** Sudden weight gain (>2 lbs in a week) may indicate fluid retention and should be reported.\n\nWhat is your current week and weight?`
        },
        {
          keywords: ['week', 'weeks', 'trimester', 'month', 'far along', 'how far'],
          text: `**Pregnancy Week Tracker**\n\n**First trimester (Weeks 1-12):**\n- Baby's organs begin forming\n- Morning sickness common\n- Key: Start prenatal vitamins, first ultrasound\n\n**Second trimester (Weeks 13-27):**\n- Energy returns, nausea usually improves\n- Baby's movements felt (18-25 weeks)\n- Key: Anatomy scan (~20 weeks), glucose screening (24-28 weeks)\n\n**Third trimester (Weeks 28-40):**\n- Baby grows rapidly\n- Prepare for delivery\n- Key: Kick counts, birth plan, hospital bag\n\n**Milestones to discuss with your provider:** Genetic screening, Tdap vaccine (27-36 weeks), Group B strep test (36 weeks).\n\nWhat week are you currently in?`
        },
        {
          keywords: ['glucose', 'sugar', 'test', 'screening'],
          text: `**Glucose Monitoring**\n\n**Glucose screening during pregnancy:**\n- Usually done between weeks 24-28\n- Glucose challenge test: Drink glucose drink, blood drawn after 1 hour\n- Target: < 140 mg/dL (some providers use 130 mg/dL)\n\n**If diagnosed with gestational diabetes:**\n- Monitor fasting glucose: Target < 95 mg/dL\n- 1 hour after meals: Target < 140 mg/dL\n- 2 hours after meals: Target < 120 mg/dL\n\n**Diet tips for blood sugar control:**\n- Pair carbs with protein\n- Choose complex carbs (whole grains, vegetables)\n- Eat small, frequent meals\n- Limit sugary drinks and sweets\n\nHave you had your glucose screening yet?`
        },
        {
          keywords: ['heart rate', 'pulse', 'heartbeat', 'bpm'],
          text: `**Heart Rate During Pregnancy**\n\n**Normal ranges:**\n- Maternal resting heart rate: 60-100 bpm (may increase 10-20 bpm during pregnancy)\n- Fetal heart rate: 110-160 bpm\n\n**Maternal heart rate changes:**\n- Blood volume increases 30-50% during pregnancy\n- Heart rate naturally increases to support this\n- Mild palpitations are common\n\n**When to be concerned:**\n- Resting heart rate > 100 bpm persistently\n- Palpitations with dizziness or shortness of breath\n- Irregular heartbeat or chest pain\n\nAre you monitoring your heart rate regularly?`
        }
      ],
      default: `**Health Monitoring**\n\nRegular monitoring helps ensure a healthy pregnancy.\n\n**Key metrics to track:**\n- Blood pressure (target: < 120/80)\n- Weight gain (per trimester guidelines)\n- Blood glucose (especially after week 24)\n- Fetal movement (kick counts from week 28)\n- Symptoms journal\n\n**Recommended schedule:** Prenatal visits every 4 weeks until week 28, every 2 weeks until week 36, then weekly.\n\nWhat would you like to monitor or discuss?`
    },
    general: {
      responses: [
        {
          keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'good afternoon'],
          text: `Hello! I'm your Nurture Glow AI Care Assistant. I'm here to help with:\n\n- **Health questions** about pregnancy symptoms and concerns\n- **Nutrition advice** for each trimester\n- **Mental health** support and coping strategies\n- **Health monitoring** — understanding your BP, weight, and glucose readings\n- **Medication safety** information\n- **Vaccine guidance** during pregnancy\n\nHow can I help you today?`
        },
        {
          keywords: ['thank', 'thanks', 'appreciate'],
          text: `You're welcome! I'm always here to help. Remember:\n\n- Track your symptoms and health metrics regularly\n- Don't hesitate to ask any question — no question is too small\n- Always consult your healthcare provider for personalized medical advice\n\nIs there anything else I can help with?`
        },
        {
          keywords: ['exercise', 'workout', 'yoga', 'walk', 'active', 'gym', 'fitness'],
          text: `**Exercise During Pregnancy**\n\nRegular physical activity is beneficial for most pregnancies.\n\n**Safe exercises:**\n- Walking (30 min/day)\n- Prenatal yoga\n- Swimming and water aerobics\n- Stationary cycling\n- Light strength training\n\n**Exercises to avoid:**\n- Contact sports\n- Activities with fall risk\n- Heavy lifting\n- Exercises lying flat on your back (after first trimester)\n- Hot yoga or exercising in excessive heat\n\n**Target:** 150 minutes of moderate activity per week.\n\n**Stop exercising and call your doctor if:** You experience bleeding, dizziness, chest pain, contractions, or fluid leakage.\n\nWhat type of exercise are you interested in?`
        },
        {
          keywords: ['sleep', 'insomnia', 'rest', 'night', 'bed', 'can\'t sleep'],
          text: `**Sleep During Pregnancy**\n\nQuality sleep becomes more challenging as pregnancy progresses.\n\n**Tips for better sleep:**\n- Sleep on your left side (improves blood flow to baby)\n- Use a pregnancy pillow between knees and under belly\n- Avoid screens 1 hour before bed\n- Keep the room cool and dark\n- Limit fluids 2 hours before bedtime to reduce bathroom trips\n\n**Common sleep disruptors:**\n- Frequent urination, heartburn, leg cramps, back pain, anxiety\n\n**Safe remedies:**\n- Warm milk or chamomile tea before bed\n- Gentle stretching or relaxation exercises\n- Consistent bedtime routine\n\n**When to seek help:** If you snore loudly or stop breathing during sleep (sleep apnea), or if insomnia persists.\n\nWhat's affecting your sleep most?`
        },
        {
          keywords: ['labor', 'delivery', 'birth', 'contractions', 'due date', 'hospital bag'],
          text: `**Preparing for Labor & Delivery**\n\n**Signs of approaching labor:**\n- Lightening (baby drops lower)\n- Mucus plug loss\n- Regular contractions (5-1-1 rule: 5 min apart, 1 min long, for 1 hour)\n- Water breaking\n\n**Hospital bag essentials:**\n- ID, insurance card, birth plan\n- Comfortable clothing, toiletries\n- Phone charger, snacks\n- Baby outfit, car seat\n- Comfort items (pillow, music)\n\n**When to go to the hospital:**\n- Contractions following the 5-1-1 pattern\n- Water breaks\n- Heavy bleeding\n- Decreased fetal movement\n\nWhat aspect of labor preparation would you like to know more about?`
        },
        {
          keywords: ['breastfeed', 'nursing', 'lactation', 'breast milk', 'formula'],
          text: `**Breastfeeding Preparation**\n\n**Benefits of breastfeeding:**\n- Provides perfect nutrition for baby\n- Boosts baby's immune system\n- Helps uterus contract post-delivery\n- Reduces risk of certain cancers\n\n**Getting started:**\n- Consider a breastfeeding class before delivery\n- Learn about latching techniques\n- Have a lactation consultant contact ready\n- Stock up on nursing bras and pads\n\n**Key reminders:**\n- Breastfeed within the first hour after birth\n- Feed on demand (8-12 times in 24 hours for newborns)\n- Both breast and formula feeding are valid choices\n\n**When to seek help:** Pain during nursing, baby not gaining weight, or feeling overwhelmed.\n\nWould you like more details about breastfeeding techniques?`
        }
      ],
      default: `**Nurture Glow AI Care Assistant**\n\nI can help with a wide range of pregnancy and maternal health topics:\n\n- **Symptoms & Medical concerns** — pain, nausea, bleeding, headaches\n- **Nutrition** — diet, vitamins, hydration\n- **Mental health** — anxiety, stress, mood changes\n- **Health monitoring** — blood pressure, weight, glucose\n- **Exercise & Sleep** — safe activities, sleep tips\n- **Labor preparation** — signs, hospital bag, birth plan\n- **Medication & Vaccine safety**\n\nPlease describe your question or concern, and I'll provide evidence-based guidance.\n\nWhat would you like to know about?`
    }
  },
  bn: {
    'mental-health': {
      default: `**গর্ভাবস্থায় মানসিক স্বাস্থ্য**\n\nআপনার মানসিক স্বাস্থ্য আপনার শারীরিক স্বাস্থ্যের মতোই গুরুত্বপূর্ণ।\n\n**পরামর্শ:**\n- প্রতিদিন ৫ মিনিট ধ্যান বা মাইন্ডফুলনেস অনুশীলন করুন\n- নিয়মিত হালকা ব্যায়াম করুন\n- পরিবার ও বন্ধুদের সাথে কথা বলুন\n- পর্যাপ্ত ঘুম নিশ্চিত করুন\n\n**কখন সাহায্য নিবেন:** যদি উদ্বেগ বা বিষণ্নতা দৈনন্দিন কাজে বাধা দেয়, তাহলে আপনার ডাক্তারের সাথে কথা বলুন।\n\nআপনি কোন বিষয়ে আরো জানতে চান?`
    },
    nutrition: {
      default: `**গর্ভাবস্থায় পুষ্টি**\n\n**সাধারণ নির্দেশিকা:**\n- বিভিন্ন ফল, সবজি, শস্য এবং প্রোটিন খান\n- ডাক্তারের পরামর্শ অনুযায়ী প্রসবপূর্ব ভিটামিন নিন\n- প্রতিদিন ৮-১২ গ্লাস পানি পান করুন\n- অল্প অল্প করে ঘন ঘন খান\n\n**যা এড়িয়ে চলুন:** কাঁচা মাছ-মাংস, অপাস্তুরাইজড দুগ্ধজাত পণ্য, অ্যালকোহল।\n\nআপনার কোন নির্দিষ্ট পুষ্টি প্রশ্ন আছে?`
    },
    medical: {
      default: `**চিকিৎসা সংক্রান্ত পরামর্শ**\n\nগর্ভাবস্থার সাধারণ উপসর্গ ও সমস্যা সম্পর্কে তথ্য প্রদান করতে পারি।\n\n**গুরুত্বপূর্ণ পরামর্শ:**\n- সব প্রসবপূর্ব চেকআপে যান\n- নতুন বা উদ্বেগজনক উপসর্গ ডাক্তারকে জানান\n- ওষুধ পরিবর্তন করার আগে ডাক্তারের পরামর্শ নিন\n\n**জরুরি সেবা নিন:** ভারী রক্তপাত, তীব্র পেটব্যথা, হঠাৎ তীব্র মাথাব্যথা, দৃষ্টি পরিবর্তন।\n\nআপনার কী ধরনের সমস্যা হচ্ছে?`
    },
    monitoring: {
      default: `**স্বাস্থ্য পর্যবেক্ষণ**\n\nনিয়মিত পর্যবেক্ষণ সুস্থ গর্ভাবস্থা নিশ্চিত করতে সাহায্য করে।\n\n**প্রধান পরিমাপ:**\n- রক্তচাপ (লক্ষ্য: < ১২০/৮০)\n- ওজন বৃদ্ধি\n- রক্তে শর্করা (বিশেষত ২৪ সপ্তাহের পর)\n- বাচ্চার নড়াচড়া (২৮ সপ্তাহ থেকে)\n\n**পরামর্শ:** প্রতিদিন একই সময়ে পরিমাপ নিন এবং রেকর্ড রাখুন।\n\nআপনি কোন বিষয়ে পর্যবেক্ষণ করতে চান?`
    },
    general: {
      default: `**নার্চার গ্লো এআই কেয়ার সহকারী**\n\nআমি গর্ভাবস্থা ও মাতৃস্বাস্থ্য বিষয়ে সাহায্য করতে পারি:\n\n- **উপসর্গ ও চিকিৎসা** — ব্যথা, বমিভাব, রক্তপাত\n- **পুষ্টি** — খাদ্য, ভিটামিন, পানি\n- **মানসিক স্বাস্থ্য** — উদ্বেগ, চাপ\n- **স্বাস্থ্য পর্যবেক্ষণ** — রক্তচাপ, ওজন\n- **ব্যায়াম ও ঘুম**\n- **ওষুধ ও টিকা নিরাপত্তা**\n\nআপনার প্রশ্ন বা উদ্বেগ বলুন, আমি প্রমাণভিত্তিক পরামর্শ দেব।\n\nআপনি কী জানতে চান?`
    }
  }
};

/**
 * Match a user message against the knowledge base to find the best response.
 */
function findBestMatch(message, intent, locale) {
  const lang = locale === 'bn' ? 'bn' : 'en';
  const kb = knowledgeBase[lang];
  const intentKb = kb[intent] || kb.general;

  // If the locale-specific intent section has responses array, search for keywords
  if (intentKb.responses) {
    const normalized = message.toLowerCase();
    
    // Score each response by keyword matches
    let bestResponse = null;
    let bestScore = 0;

    for (const entry of intentKb.responses) {
      let score = 0;
      for (const kw of entry.keywords) {
        if (normalized.includes(kw)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestResponse = entry;
      }
    }

    if (bestResponse) {
      return bestResponse.text;
    }
  }

  // Fall back to the default response for this intent
  return intentKb.default || kb.general.default;
}

/**
 * Run the fallback model — no API needed, always returns a response.
 */
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

  if (intent === 'appointment') {
    const appMsg = locale === 'bn'
      ? `**অ্যাপয়েন্টমেন্ট বুকিং নির্দেশিকা**\n\nঅ্যাপয়েন্টমেন্ট বুক করার জন্য:\n1. প্রধান পোর্টালের **Doctors** সেকশনে যান।\n2. আপনার পছন্দের ডাক্তারের পাশে থাকা **View Schedule** বাটনে ক্লিক করুন।\n3. দিন এবং খালি সময়ের স্লট নির্বাচন করে বুকিং সম্পন্ন করুন।\n\nআপনার কি কোনো ডাক্তারের সময়সূচী বা স্লট জানতে সাহায্য লাগবে? ডাক্তারের নাম দিয়ে জিজ্ঞাসা করতে পারেন।`
      : `**How to Book an Appointment**\n\nTo schedule a consultation:\n1. Go to the **Doctors** directory on the portal.\n2. Find your doctor and click **View Schedule**.\n3. Choose your preferred day and available 30-minute time slot to confirm your booking.\n\nWould you like to search for a specific specialist? Try asking "suggest a gynecologist".`;
    return {
      text: appMsg,
      modelUsed: 'fallback-guided',
      sources: [],
      riskLevel: undefined
    };
  }

  const text = findBestMatch(message, intent, locale);

  // If we have user context, prepend a personalized note
  let finalText = text;
  if (context) {
    const contextNote = locale === 'bn'
      ? `📋 *আপনার তথ্যের ভিত্তিতে:* ${context}\n\n`
      : `📋 *Based on your data:* ${context}\n\n`;
    finalText = contextNote + text;
  }

  return {
    text: finalText,
    modelUsed: 'fallback',
    sources: [],
    riskLevel: undefined
  };
}
