import { motion } from "framer-motion";

export default function TitleMain({title, subtitle} : {title: string, subtitle: string}) {
    return (
        <section className="relative py-20 overflow-hidden">
            <motion.div
                className="absolute inset-0 -z-10 bg-gradient-to-r from-cyan-700 via-blue-900 to-indigo-800"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2 }}
                aria-hidden="true"
            >
                <motion.div
                    className="absolute top-0 left-0 w-1/2 h-full bg-white opacity-10 blur-3xl"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ repeat: Infinity, repeatType: "loop", duration: 6, ease: "linear" }}
                    aria-hidden="true"
                />
            </motion.div>

            <div className="container mx-auto px-6 md:px-12 relative z-10 text-center text-white max-w-3xl">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="text-4xl font-bold mb-6 drop-shadow-lg"
                >
                    {title}
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    viewport={{ once: true }}
                    className="text-lg leading-relaxed drop-shadow-md"
                >
                    {subtitle}
                </motion.p>
            </div>
        </section>
    );
}