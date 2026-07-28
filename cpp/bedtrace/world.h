#pragma once
class World
{
public:
    World(int64_t seed, int32_t l, int32_t u, std::string worldType);
    ~World();
    int at(int32_t x, int32_t y, int32_t z);
private:
    int32_t upper, lower;
    uint64_t rseed0, rseed1;
};