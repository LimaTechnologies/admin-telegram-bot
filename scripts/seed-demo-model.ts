#!/usr/bin/env bun
/**
 * Seed Demo Model
 * Creates a demo model with placeholder photos and products for testing the purchase flow
 */

import { connectDB, disconnectDB, OFModel, TelegramGroup, getBotApi, logger } from '@common';

// Demo model data - usando unsplash para fotos mais realistas
const DEMO_MODEL = {
  name: 'Amanda Silva',
  username: 'amanda_exclusive',
  onlyfansUrl: 'https://onlyfans.com/amanda_exclusive',
  profileImageUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop',
  bio: 'Conteudo exclusivo todos os dias! Brasileira, 23 anos.',
  tier: 'gold' as const,
  referralLink: 'https://onlyfans.com/amanda_exclusive?ref=telegram',
  niche: ['brasileira', 'fitness', 'lifestyle'],
  isActive: true,
  // 4 Preview photos - fotos gratuitas que todo mundo ve
  previewPhotos: [
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop',
    'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=600&h=800&fit=crop',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop',
  ],
  // Products for sale - packs avulsos e assinatura
  products: [
    {
      name: 'Pack Verao',
      description: '15 fotos exclusivas na praia',
      type: 'content' as const,
      price: 29.90,
      currency: 'BRL' as const,
      previewImages: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=300&fit=crop',
      ],
      isActive: true,
    },
    {
      name: 'Pack Fitness',
      description: '20 fotos + 3 videos de treino',
      type: 'ppv' as const,
      price: 49.90,
      currency: 'BRL' as const,
      previewImages: [
        'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&h=300&fit=crop',
      ],
      isActive: true,
    },
    {
      name: 'Assinatura VIP',
      description: 'Todo conteudo novo + chat privado',
      type: 'subscription' as const,
      price: 79.90,
      currency: 'BRL' as const,
      previewImages: [
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=300&fit=crop',
      ],
      isActive: true,
    },
  ],
};

async function seedDemoModel() {
  logger.info('Starting demo model seed...');

  await connectDB();
  logger.info('Connected to database');

  // Check if model already exists
  let model = await OFModel.findOne({ username: DEMO_MODEL.username });

  if (model) {
    logger.info('Demo model already exists, updating...');
    // Update existing model
    model.name = DEMO_MODEL.name;
    model.bio = DEMO_MODEL.bio;
    model.tier = DEMO_MODEL.tier;
    model.previewPhotos = DEMO_MODEL.previewPhotos;
    model.products = DEMO_MODEL.products as typeof model.products;
    model.isActive = true;
    await model.save();
    logger.info('Demo model updated', { id: model._id, name: model.name });
  } else {
    // Create new model
    model = await OFModel.create(DEMO_MODEL);
    logger.info('Demo model created', { id: model._id, name: model.name });
  }

  console.log('\n✅ Demo model ready!');
  console.log(`   Name: ${model.name}`);
  console.log(`   Username: @${model.username}`);
  console.log(`   ID: ${model._id}`);
  console.log(`   Products: ${model.products.length}`);
  console.log(`   Tier: ${model.tier}`);

  return model;
}

async function sendPromoToGroup(modelId: string) {
  logger.info('Looking for registered groups...');

  // Find active groups
  const groups = await TelegramGroup.find({
    'settings.isActive': true,
    'botPermissions.canPostMessages': true,
  }).limit(1);

  if (groups.length === 0) {
    console.log('\n⚠️  No active groups found with posting permissions.');
    console.log('   Add the bot to a group as admin first.');
    return;
  }

  const group = groups[0];
  console.log(`\n📢 Sending promo to group: ${group.name || group.telegramId}`);

  try {
    const api = await getBotApi();
    const botInfo = await api.getMe();

    // Build deep link URL
    const deepLink = `https://t.me/${botInfo.username}?start=model_${modelId}`;

    // Send promotional message with inline button
    await api.sendPhoto(group.telegramId, 'https://picsum.photos/seed/promo/800/600', {
      caption:
        '🔥 *CONTEÚDO EXCLUSIVO* 🔥\n\n' +
        '💋 Amanda Silva está com promoção especial!\n' +
        '📸 Fotos e vídeos que você não encontra em nenhum lugar\n\n' +
        '👇 Clique no botão abaixo para ver mais!',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔥 Quero Ver Mais',
              url: deepLink,
            },
          ],
        ],
      },
    });

    console.log('✅ Promotional message sent!');
    console.log(`   Group: ${group.name || group.telegramId}`);
    console.log(`   Deep link: ${deepLink}`);
  } catch (error) {
    logger.error('Error sending promo message', { error });
    console.log('\n❌ Error sending message. Check bot permissions.');
  }
}

async function main() {
  try {
    const model = await seedDemoModel();

    // Ask if should send promo
    const args = process.argv.slice(2);
    if (args.includes('--promo') || args.includes('-p')) {
      await sendPromoToGroup(model._id.toString());
    } else {
      console.log('\n💡 To send promo message to a group, run:');
      console.log('   bun scripts/seed-demo-model.ts --promo');
    }

    await disconnectDB();
    console.log('\n🎉 Done!');
    process.exit(0);
  } catch (error) {
    logger.error('Seed failed', { error });
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

main();
