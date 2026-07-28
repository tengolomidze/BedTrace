#pragma once
#include <cstdint>
#include <utility>
#include <string>

class Xoroshiro {
public:
    Xoroshiro(uint64_t s0, uint64_t s1);
    Xoroshiro(int64_t seed, const std::string& str);
    ~Xoroshiro() = default;
    uint64_t next();
    float nextFloat();
    std::pair<uint64_t, uint64_t> state() const { return { s[0], s[1] }; }
    static std::pair<uint64_t, uint64_t> seed128(int64_t seed);
    static uint64_t mix(uint64_t v);
    Xoroshiro* at(int32_t x, int32_t y, int32_t z);
private:
    uint64_t s[2];
    static constexpr float FLOAT_UNIT = 5.9604645e-8f;   // 1.0f / (1 << 24)
    static constexpr double DOUBLE_UNIT = 1.110223e-16;  // 1.0 / (1ULL << 53)
    static constexpr uint64_t lmagic = 0x5DEECE66DULL;
    static constexpr uint64_t lmask = ((1ULL << 48) - 1ULL);
    static constexpr uint64_t xmagic0 = 0x6a09e667f3bcc909ULL;
    static constexpr uint64_t xmagic1 = 0x9e3779b97f4a7c15ULL;
};