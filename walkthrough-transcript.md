# Pocket Pilot: one picture, one decision

Explanatory animation and recorded measurements, not live inference. Synthetic narration: Gemini 3.8 Flash TTS (Kore). AI-generated instrumental: Lyria 3.5, mixed quietly with speech ducking. Script and creative outline reviewed with Gemini; technical claims edited and checked against the saved benchmark.

## 00:00:00.000 · One picture. One decision.

Where would you steer? The opening is on the left. For us, that's easy. For this little car, it means sending a picture, asking a question, and waiting for an answer. Let's follow that journey in Pocket Pilot.

## 00:00:16.250 · Follow one decision

First, capture the road. Ask: which lane is open? Give the model three allowed answers: left, middle, or right. It returns a choice. Our code checks that answer, then moves the car. The model suggests; the application controls what happens next.

## 00:00:35.375 · Model, image, API

A language model works with text. A vision language model can also read images. An API is the interface our code uses to ask either one a question. Jev is a model from TypeSafe, using text and JSON here. It isn't the Java programming language.

## 00:00:52.708 · Decide the answer shape first

With a Decisions API, we define the question and the shape of its answer before making the call. Here is a shortened example: a road image goes in, and a lane choice comes back. Only that lane answer is needed to steer.

## 00:01:09.167 · Three useful answer types

Choice picks a label, with probabilities and a separate confidence value. Noul answers a yes-or-no question with a number between zero and one. Score places an answer on ordered levels, so fractions are possible. These are estimates. Even a confidence of one can be wrong.

## 00:01:29.042 · How is this different from chat?

A conventional model can explain the road. It can also return JSON that follows a schema. Decisions is useful when we already know the possible answers and want typed results. Whether a particular model is faster or better is something to measure, not assume.

## 00:01:46.792 · While the model thinks…

Watch what happens while an answer is on its way. If the road keeps moving, that answer can arrive too late. Classroom mode pauses the game clock until a fresh decision returns. Real time mode exposes that delay. A correct answer can still miss its deadline.

## 00:02:04.333 · How long did we wait?

Here are all six models in the same one-question comparison. For images, Luna took about six tenths of a second; the chat models, about one and a half seconds. With structured JSON, Jev and Luna were both near half a second. Each number is a median of just three scenes.

## 00:02:23.500 · Keep the mistakes in the picture

The full run used sixty-three settings and a hundred and eighty-nine attempts. We saw a hundred and sixty-eight correct lane choices, three wrong choices, and eighteen request-size errors. These timings include the network and the complete response. This small experiment is a starting point, not a universal ranking.

## 00:02:45.292 · Next: field-photo triage

For the Sustainability Lab, start with a photo-quality check. Is this image usable, blurred, or obstructed? We can label examples ourselves and check the model's mistakes. Later, try smoke or solar-panel review. Those are proposed applications; a smoke photograph alone cannot measure particulate concentration.

## 00:03:08.667 · Or: help review sensor data

Another idea: a sensor reading stays at zero, while a field note mentions a power interruption. Combine the readings and context, then suggest what a researcher should check. Compare with simple rules. Keep the original data, and send uncertain cases for review.

## 00:03:28.167 · Now try it yourself

Open the game and choose a model, an input, and a question count. Start in classroom mode. Follow one decision through its image, question, answer, and timing. Pause, go back in the log, and open the JSON. That's where this small game becomes a useful experiment.
