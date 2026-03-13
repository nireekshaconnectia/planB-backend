const mongoose = require('mongoose');
const Menu = require('../models/Menu');
require('dotenv').config();

// List of English to Arabic menu item names
const translations = [
  { en: 'Affogato', ar: 'أفوكاتو' },
  { en: 'Americano', ar: 'امريكانو' },
  { en: 'Tiramisu Latte', ar: 'تيراميسو لاتيه' },
  { en: 'Cappucino', ar: 'كابتشينو' },
  { en: 'Chamomile Tea', ar: 'شاي البابونج' },
  { en: 'Chemex', ar: 'كيمكس' },
  { en: 'Cortado', ar: 'كورتادو' },
  { en: 'Double Espresso', ar: 'دبل اسبريسو' },
  { en: 'English Breakfast Tea', ar: 'شاي احمر' },
  { en: 'Espresso', ar: 'اسبريسو' },
  { en: 'Flat White', ar: 'فلات وايت' },
  { en: 'Green Tea', ar: 'شاي اخضر' },
  { en: 'Hot Chocolate', ar: 'هوت شوكليت' },
  { en: 'brulee Latte', ar: 'بروليه لاتيه' },
  { en: 'Matcha Latte', ar: 'ماتشا لاتيه' },
  { en: 'Non-coffee Matcha', ar: 'ماتشا مع الحليب' },
  { en: 'Plan B-Signature', ar: 'بلان بي سيغنتشر' },
  { en: 'Spanish Latte', ar: 'سبانيش لاتيه' },
  { en: 'Latte', ar: 'لاتيه' },
  { en: 'V60', ar: 'V60' },
  { en: 'Summer box', ar: 'بوكس الصيف' },
  { en: 'Strawberry Matcha', ar: 'ماتشا الفراولة' },
  { en: 'Iced Plan B Signature', ar: 'ايس بلان بي سيغنتشر' },
  { en: 'Cold Brew', ar: 'كولد برو' },
  { en: 'Iced cappucino', ar: 'ايس كابتشينو' },
  { en: 'Iced spanish latte', ar: 'ايس سبانيش' },
  { en: 'Iced latte', ar: 'ايس لاتيه' },
  { en: 'Iced Matcha latte', ar: 'ايس ماتشا لاتيه' },
  { en: 'Iced Non-coffee matcha', ar: 'ايس ماتشا' },
  { en: 'Iced americano', ar: 'ايس امريكانو' },
  { en: 'Iced v60', ar: 'ايس V60' },
  { en: 'Iced tiramisu latte', ar: 'ايس تيراميسو لاتيه' },
  { en: 'Beet It', ar: 'بيت-ديتوكس' },
  { en: 'Green Detox', ar: 'جرين ديتوكس الاخضر' },
  { en: 'Orange Juice', ar: 'عصير برتقال' },
  { en: 'Iced Brûlée latte', ar: 'ايس بروليه لاتيه' },
  { en: 'Iced Chemex', ar: 'ايس كيمكس' },
  { en: 'B1 Latte', ar: 'بي 1 لاتيه' },
  { en: 'Colada', ar: 'كولادا' },
  { en: 'Passion fruit iced tea', ar: 'باشن فروت ايس تي' },
  { en: 'Acai Lemonade', ar: 'اسي ليمونيد' },
  { en: 'Tropical Treat', ar: 'تروبيكال تريت' },
  { en: 'Antioxidant smoothie', ar: 'عصير مضاد للاكسدة' },
  { en: 'Normal water', ar: 'ماء' },
  { en: 'Sparkling water', ar: 'ماء غازي' },
  { en: 'Salted Caramel Chocolate Tart', ar: 'سولتد كراميل شوكليت تارت' },
  { en: 'San Sebastian', ar: 'سان سيباستيان' },
  { en: 'Victoria cake', ar: 'فيكتوريا كيك' },
  { en: 'Clasic Blueberry cheesecake', ar: 'تشيز كيك' },
  { en: 'B Signature French Toast', ar: 'فرنش توست' },
  { en: 'Tiramisu', ar: 'تيراميسو' },
  { en: 'Honey toast', ar: 'توست العسل' },
  { en: 'Carrot Cake', ar: 'كيكة الجزر' },
  { en: 'Brownies Chocolate Bomb', ar: 'براونيز' },
  { en: 'Coconut Cake', ar: 'كيكة جوز الهند' },
  { en: 'Corn Ribs', ar: 'اضلاع الذرة' },
  { en: 'Granola Blast', ar: 'جرانولا' },
  { en: 'Tuna Avocado Sandwich', ar: 'ساندويش التونة والأفوكادو' },
  { en: 'Halloumi Sandwich', ar: 'ساندويش الحلوم' },
  { en: 'Turkey Sandwich', ar: 'ساندويش التركي' },
  { en: 'Cheesy Roasted Beef Sandwich', ar: 'ساندويش اللحم' },
  { en: 'Cheese Croissant', ar: 'كرواسون جبن' },
  { en: 'Chocolate Croissant', ar: 'كرواسون الشوكولاتة' },
  { en: 'Plain Croissant', ar: 'كرواسون ساده' },
  { en: 'Chicken Tatziki Wrap', ar: 'راب دجاج تاتزكي' },
  { en: 'Zaatar Babka', ar: 'بابكا الزعتر' },
  { en: 'Chicken Eggplant Sandwich', ar: 'ساندويش دجاج بالباذنجان' },
  { en: 'Avocado and Mozarella Toast', ar: 'توست افوكادو و موزاريلا' },
  { en: 'Chicken Ceaser Salad', ar: 'سلطة سيزر الدجاج' },
  { en: 'Honey Mustard Salad', ar: 'سلطة الخردل بالعسل' },
  { en: 'Super Food Salad', ar: 'سلطة السوبر فود' },
  { en: 'Eggs Benedict', ar: 'بيض بنديكت' },
  { en: 'Mini Falafel Platter', ar: 'ميني فلافل' },
  { en: 'Truffle eggs sandwich', ar: 'ساندويش بيض الكمأة' },
  { en: 'Hummus', ar: 'حمص' },
  { en: 'Buratta on Toast', ar: 'بوراتا على الخبر المحمص' },
  { en: 'Gemar on Honey croissant', ar: 'كرواسون بالعسل' },
  { en: 'Scrambled eggs with mushroom sauce', ar: 'بيض مخفوق مع صوص المشروم' },
  { en: 'Labneh and Zatar sourdough', ar: 'سوردو لبنة وزعتر' },
  { en: 'Shakshooka', ar: 'شكشوكة' },
  { en: 'Croque Madame', ar: 'كروك مادام' },
  { en: 'Turkish Egg', ar: 'بيض تركي' },
  { en: 'Arabic Platter', ar: 'طبق عربي' },
  { en: 'Specialty Coffee Bag', ar: 'قهوة مخصصة' },
  { en: 'coffee capsules', ar: 'كبسولات القهوة' }
];

const batchUpdate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    let updated = 0;
    let notFound = [];

    for (const { en, ar } of translations) {
      // Use case-insensitive regex for name matching
      const menuItem = await Menu.findOne({ name: { $regex: `^${en}$`, $options: 'i' } });
      if (menuItem) {
        menuItem.nameAr = ar;
        await menuItem.save();
        console.log(`Updated: ${menuItem.name} -> ${ar}`);
        updated++;
      } else {
        console.log(`Not found: ${en}`);
        notFound.push(en);
      }
    }

    console.log(`\nTotal updated: ${updated}`);
    if (notFound.length) {
      console.log('Not found:', notFound.join(', '));
    }
  } catch (error) {
    console.error('Error during batch update:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

batchUpdate(); 