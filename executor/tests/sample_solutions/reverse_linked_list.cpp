/**
 * @file reverse_linked_list.cpp
 * @brief Sample solution for LeetCode 206: Reverse Linked List
 *
 * This solution demonstrates linked list pointer manipulation.
 * The tracer should capture the movement of prev, curr, and next pointers
 * through each iteration.
 *
 * Problem: Reverse a singly linked list.
 * Input:  head = [1,2,3,4,5]
 * Output: [5,4,3,2,1]
 *
 * GDB Trace Expectations:
 * - Each iteration should show prev, curr, and next variables
 * - The linked list structure should be visible in heap
 * - Pointer updates should be captured at each step
 *
 * Compilation:
 *   g++ -g -std=c++17 reverse_linked_list.cpp -o reverse_linked_list
 */

#include <iostream>
#include <vector>
#include "../templates/structures.hpp"
#include "../templates/deserializers.hpp"

/**
 * @brief Solution class for reversing a linked list
 */
class Solution {
public:
    /**
     * @brief Reverses a singly-linked list iteratively.
     *
     * Uses three pointers:
     * - prev: Tracks the already-reversed portion
     * - curr: Current node being processed
     * - next: Next node to process (temporarily stored)
     *
     * @param head Pointer to head of list
     * @return Pointer to new head (previously the tail)
     */
    ListNode* reverseList(ListNode* head) {
        ListNode* prev = nullptr;  // Previous node (initially null)
        ListNode* curr = head;      // Current node starts at head

        while (curr != nullptr) {
            // Store next before we overwrite curr->next
            ListNode* next = curr->next;

            // Reverse the link
            curr->next = prev;

            // Move pointers forward
            prev = curr;
            curr = next;
        }

        // prev is now the new head
        return prev;
    }
};

/**
 * @brief Main function - test harness
 *
 * Reads input from stdin and runs the solution.
 * Expected input format: [1,2,3,4,5]
 */
int main() {
    // Read input
    std::string line;
    std::getline(std::cin, line);

    // Parse input array
    std::vector<int> values = parseIntArray(line);

    // Build linked list
    ListNode* head = buildList(values);

    // Run solution
    Solution sol;
    ListNode* result = sol.reverseList(head);

    // Output result
    std::vector<int> output = serializeList(result);
    std::cout << "[";
    for (size_t i = 0; i < output.size(); i++) {
        if (i > 0) std::cout << ",";
        std::cout << output[i];
    }
    std::cout << "]" << std::endl;

    return 0;
}
