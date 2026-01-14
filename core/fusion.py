def fuse(ecapa, pitch, rate, w1=0.70, w2=0.15, w3=0.15):
    final_score = w1 * ecapa + w2 * pitch + w3 * rate
    
    print(f"ECAPA   : {ecapa:.3f}")
    print(f"Pitch   : {pitch:.3f}")
    print(f"Rate    : {rate:.3f}")
    print(f"FUSED   : {final_score:.3f}")
    
    return final_score  