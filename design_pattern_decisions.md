## Design decisions
- Any if statements used in the contract are for branching or logic. Whenever the contract requires certain conditions to continue, I use require statements.
- All contract variables are private.
- My contract does not auto-deprecate. There is no need for it to do so.
- My contract is not mortal. I want it to remain alive without the possibility of an admin pulling the plug on the whole thing. Similarly, this is why the emergency stop only stops wager creation; I do not want an admin to be able to prevent all wagers from being verified and thereby steal a bunch of ether from users.
- There's no need to use a withdrawal pattern in my contract since any transfers happen in a method that only oraclize can call. A malicious user could still hit the verify function twice, but they'd have no control over when the __callback function was hit. Still, to protect against this edge case, I delete the active wager as soon as possible inside the callback function.
- My contract does not need to have different stages, so it is not a state machine.
- My contract does not have a speed bump. It did not make sense to me to put a speed bump in this contract since users have limited interaction with it.
- Oraclize offers a way for contracts to get mathematically verified proofs of the information returned from different sources. I did not go that route as users know their own weights and only need for the contract to also know their weight. In fact, if I were to take this to production, I would probably make my own oracle to connect to the smart scale APIs. This would make the oraclizing process cheaper and give me more control over my app. As it stands, if oraclize goes down, my contract is useless.
- Blocktime cannot be trusted down to the second. However, I still use "now" in my contract to determine whether a wager is expired. This is because, in production, we would be using days, and so the ~10 seconds that "now" could be off by would not really affect anything.

## Other ideas
Finally, there are many features and ideas I wanted to implemented before I ran out of time. Here are some of my ideas:

 - Don't rely on the user to verify the wagers. Instead, have the user pre-sign a verifyWager call, store that pre-signed transaction, and broadcast it automatically at the time of expiration.
 - Of course, people can cheat and make their scale say anything. It would be hard to cheat the Naked scale (see the README), but in general, to avoid cheating, we could require users to weigh themselves every day while the app could do a little bit of data analysis to verify a decent downward trajectory in the numbers.
 - The wager mappings in the contract could slowly get filled with junk under certain error conditions. It would be nice to have a process in place to remove junk wagers every once in a while.
 - More fitness goals than just losing weight. You could even connect this same system to a GPS-connected wearable to verify that the user, for instance, jogged one mile each day.
