# Pocket Pilot walkthrough

Recorded slides and saved API results. Synthetic narration: macOS Samantha.

## 00:00:00.000 · The game

Look at this road. The gap is on the left. Our program sends the picture to a model, gets a lane choice back, and uses that answer to steer. This is a recorded walkthrough of Pocket Pilot.

## 00:00:11.167 · Model and API

A language model works with text. A vision language model can also read images. An API is the interface our program uses to call a model. Those are separate ideas. The model supplies an answer, while our own code decides how and when to act on it.

## 00:00:26.208 · A Decisions request

A Decisions request starts with the current state and a small question. Here, the state is a road image, and the question is: which lane is open? We supply the allowed answers, left, middle, and right. The response contains a typed answer that our program can inspect.

## 00:00:42.510 · Where Jev fits

Jev is a model made by TypeSafe. It reads text or structured JSON in this demo. Luna and Clef can also receive images. The Decisions API defines the interface, while OpenRouter sends our request to the selected provider. Changing the model can change accuracy, speed, and cost.

## 00:01:00.635 · Compared with a conventional model

A conventional model can explain the road, or generate a small JSON object using a schema. Decisions is useful when the answer types and options are already known. Specialized models can score those options directly. But the API name alone does not guarantee faster or more accurate answers. We need to measure that.

## 00:01:19.594 · Three answer shapes

The three types answer different questions. Choice selects a label and returns probabilities over the labels. The yes probability type returns a number between zero and one. Score uses ordered levels and can return a fractional value. These are model estimates. A probability of one does not prove the answer is correct.

## 00:01:38.013 · The actual request

Here is a real request from an earlier recorded call. It contains the model, the state, and the questions. The image is sent as a data URL. We shorten its bytes on screen, but students can download the exact request and inspect the full input.

## 00:01:52.655 · The actual response

The response chose left. The other answers describe whether the middle lane is blocked and where the barrier appears. Only the lane answer controls this game. The timing shown here belongs to this one example. The benchmark slides summarize many separate calls.

## 00:02:07.280 · A complete comparison

The new benchmark covers sixty three settings with three scenes per setting: a hundred and eighty nine attempts. We test all supported models, three image sizes, and one, two, or three questions. The table shows accuracy, errors, median and mean time, the observed range, reported tokens, and cost. Use the controls to compare the same setting across models.

## 00:02:30.196 · What the numbers say

For the one question, four hundred and twenty pixel image, Luna's median was about point six seconds. The two chat models were about one point six seconds. With JSON, Jev and Luna were both around half a second. Across the complete experiment, there were three wrong lane choices and eighteen request size errors. Speed is only one part of the result.

## 00:02:51.043 · Visual sustainability demos

For the Sustainability Lab, I would start with field photo quality: is an image usable, blurred, or obstructed? Students can check those labels themselves. Other possibilities include visible smoke triage, solar panel inspection, and waste audits. These are proposed applications. A smoke image cannot, by itself, tell us the particulate concentration.

## 00:03:13.668 · Data-based sustainability demos

Some useful decisions need no image. We could combine sensor readings with technician notes, review building energy events, or route a research question to the right data tool. Simple rules should remain a baseline. A model is most interesting when context matters, and its suggested action should leave evidence for a person to review.

## 00:03:32.918 · A sensor review example

This sensor example is invented for teaching. A reading has stayed at zero while nearby measurements are higher. The question is what to check next. A typed answer could put the case in a review queue. It should not silently delete the measurement or claim that it has diagnosed the cause.

## 00:03:48.752 · The next experiment

Choose a task with labels we can check. Hold out examples before tuning, compare simple rules with conventional models and Decisions, and report mistakes as well as speed and cost. Keep a review option for ambiguous cases. Then use Pocket Pilot to inspect every request, response, image, and timing for yourself.
