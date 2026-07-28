#include <iostream>
#include "world.h"

using namespace std;

int main0() {
	World world(4040957468446606363, -64, -59, "minecraft:bedrock_floor");
	
	for (int z = 10014; z < 10020; z++) {
		for (int x = 1011; x < 1016; x++) {
			cout << world.at(x, 4, z) << " ";
		}
		cout << endl;
	}

	return 0;
}