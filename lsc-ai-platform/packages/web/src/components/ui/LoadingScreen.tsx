import { motion } from 'framer-motion';

/**
 * 全屏加载组件
 * 用于页面懒加载时的占位显示
 */
export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-cream-50">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Logo 或品牌标识 */}
        <div className="relative">
          <motion.div
            className="w-12 h-12 rounded-xl bg-brand-500"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [1, 0.8, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-brand-300"
            animate={{
              scale: [1, 1.3],
              opacity: [0.5, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        </div>

        {/* 文字 */}
        <span className="text-sm text-accent-500 font-medium">
          Loading...
        </span>
      </motion.div>
    </div>
  );
}
