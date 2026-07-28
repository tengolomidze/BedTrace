#pragma once

#include <cstdint>
#include <string>
#include <vector>

class Legacy {
    public:
        Legacy() : Legacy(5489) {}
        Legacy(int64_t seed);
        Legacy(int64_t seed, const std::string& str);
        uint64_t state() { return m_seed; }
        void setSeed(int64_t seed);
        int32_t next(int bits);
        int32_t nextInt();
        int32_t nextInt(int32_t bound);
        int64_t nextLong();
        float nextFloat();
        double nextDouble();
        bool nextBoolean();
        void nextBytes(std::vector<uint8_t>& bytes);
        Legacy* at(int32_t x, int32_t y, int32_t z);
    private:
        static constexpr uint64_t MULTIPLIER = 0x5DEECE66DULL;
        static constexpr uint64_t ADDEND = 0xBULL;
        static constexpr uint64_t MASK = (1ULL << 48) - 1;
        static constexpr double   DOUBLE_UNIT = 1.0 / (static_cast<int64_t>(1) << 53);

        uint64_t m_seed;
        bool     m_haveNextNextGaussian = false;
};