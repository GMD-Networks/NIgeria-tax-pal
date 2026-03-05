import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const tips = {
  en: [
    "Always keep records of all your income sources for accurate tax filing.",
    "PAYE is automatically deducted from your salary by your employer.",
    "You can claim tax relief on pension contributions up to certain limits.",
    "Late tax filing attracts penalties - file before the deadline!",
    "Withholding tax rates vary depending on the type of transaction.",
  ],
  yo: [
    "Máa pa ìwé gbogbo owó tí ó wọlé mọ́ fún fífi owó-orí sílẹ̀ dáadáa.",
    "PAYE máa ń yọ kúrò nínú owó-ìṣẹ́ rẹ láti ọ̀dọ̀ agbáṣiṣẹ́pọ̀ rẹ.",
    "O lè béèrè ìdínkù owó-orí lórí owó pẹ́nṣọ́ọ̀nù rẹ.",
    "Fífi owó-orí sílẹ̀ pẹ́ máa ń fà ìjìyà - fi sílẹ̀ kí ọjọ́ tí a yàn tó.",
  ],
  ha: [
    "Ku riƙe bayanan kuɗin shigar ku don biyan haraji daidai.",
    "Ana cire PAYE daga albashin ku ta wurin mai aiki.",
    "Kuna iya neman ragewa kan kuɗin fansho.",
    "Jinkirin biyan haraji yana da hukunci - ku biya kafin lokaci!",
  ],
  pcm: [
    "Always keep record of all your money wey dey come in for correct tax filing.",
    "PAYE dey automatically comot from your salary by your employer.",
    "You fit claim tax relief on pension contributions.",
    "If you file tax late, you go pay penalty - file before deadline!",
  ],
  ig: [
    "Na-edebe ndekọ ego niile batara maka ịkwụ ụtụ nke ọma.",
    "A na-ewepụ PAYE n'ụgwọ ọnwa site n'aka onye ọrụ gị.",
    "Ị nwere ike ịrịọ mwepu ụtụ na ntinye ego ụgwọ ọzụzụ.",
    "Ịkwụ ụtụ na-atụfu oge na-eweta ntaramahụhụ!",
  ],
};

export function TaxTip() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as keyof typeof tips;
  const langTips = tips[currentLang] || tips.en;
  
  // Get a random tip based on the day
  const today = new Date().getDate();
  const tipIndex = today % langTips.length;
  const tip = langTips[tipIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="bg-accent/50 border border-accent rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/20">
          <Lightbulb className="w-4 h-4 text-secondary" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-accent-foreground mb-1">
            {t('home.tipOfDay')}
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
        </div>
      </div>
    </motion.div>
  );
}
